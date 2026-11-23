import fs from 'node:fs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const targets = await fetch('http://127.0.0.1:9333/json').then((r) => r.json());
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res) => { ws.onopen = res; });
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (x) => {
  const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500));
  return r.result?.result?.value;
};
await send('Runtime.enable');
await sleep(600);

const b64 = fs.readFileSync('D:/0tools/cert-test.b64', 'utf8').trim();

console.log('=== 在桌面端内跑完整脱敏闭环 ===');
const out = await ev(`(async () => {
  const bin = atob(${JSON.stringify(b64)});
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: 'image/png' });

  // 1) 调 OCR 拿到敏感坐标
  const saved = await window.__TAURI_INTERNALS__.invoke('save_blob_base64', { dataBase64: btoa(bin) });
  const ocr = await window.__TAURI_INTERNALS__.invoke('ocr_blob_windows', { sha256: saved.sha256, lang: 'zh-Hans-CN' });

  // 2) 按 Rust 返回的像素坐标转归一化遮罩框
  const W = ocr.width, H = ocr.height;
  const pad = 0.006;
  const boxes = ocr.sensitive.map(s => ({
    x: Math.max(0, s.x / W - pad),
    y: Math.max(0, s.y / H - pad),
    w: Math.min(1, (s.w / W) + pad * 2),
    h: Math.min(1, (s.h / H) + pad * 2),
  }));

  // 3) 用前端 renderRedactedBlob 渲染脱敏版（不改原件）
  const mod = await import('/assets/' + [...document.querySelectorAll('script[type=module]')].map(s=>s.src.split('/').pop())[0]).catch(() => null);
  return JSON.stringify({ engine: ocr.engine, W, H, sensitive: ocr.sensitive, boxes, blobOk: !!blob });
})()`);

const parsed = JSON.parse(out);
console.log('OCR 引擎:', parsed.engine);
console.log('图片尺寸:', parsed.W + 'x' + parsed.H);
console.log('检测到的敏感信息:');
for (const s of parsed.sensitive) {
  console.log('  -', s.kind, s.label, `(${s.x},${s.y},${s.w},${s.h})`);
}
console.log('归一化遮罩框:', JSON.stringify(parsed.boxes.map(b => ({ x: +b.x.toFixed(4), y: +b.y.toFixed(4), w: +b.w.toFixed(4), h: +b.h.toFixed(4) }))));

// 4) 用 Canvas 渲染脱敏效果并导出图片
const render = await ev(`(async () => {
  const bin = atob(${JSON.stringify(b64)});
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: 'image/png' });
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const boxes = ${JSON.stringify(parsed.boxes)};
  for (const box of boxes) {
    const x = Math.round(box.x * canvas.width), y = Math.round(box.y * canvas.height);
    const w = Math.max(4, Math.round(box.w * canvas.width)), h = Math.max(4, Math.round(box.h * canvas.height));
    ctx.fillStyle = '#1c1917'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    const bs = Math.max(8, Math.round(Math.min(w,h)/4));
    for (let px = x; px < x+w; px += bs) for (let py = y; py < y+h; py += bs) {
      if (((Math.floor((px-x)/bs)+Math.floor((py-y)/bs)) & 1) === 0) ctx.fillRect(px, py, Math.min(bs, x+w-px), Math.min(bs, y+h-py));
    }
  }
  const out = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const buf = new Uint8Array(await out.arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return JSON.stringify({ size: buf.length, b64: btoa(s) });
})()`);

const r = JSON.parse(render);
fs.writeFileSync('D:/0tools/redacted.png', Buffer.from(r.b64, 'base64'));
console.log('脱敏版已保存 D:/0tools/redacted.png (' + r.size + ' 字节)');
ws.close();
