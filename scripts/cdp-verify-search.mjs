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
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result?.result?.value;
};
await send('Runtime.enable');
await sleep(600);

const b64 = fs.readFileSync('D:/0tools/cert-test.b64', 'utf8').trim();

const out = await ev(`(async () => {
  const saved = await window.__TAURI_INTERNALS__.invoke('save_blob_base64', { dataBase64: ${JSON.stringify(b64)} });
  const ocr = await window.__TAURI_INTERNALS__.invoke('ocr_blob_windows', { sha256: saved.sha256, lang: 'zh-Hans-CN' });

  const hay = ['证书照片', 'cert.jpg', '', '', '', ocr.text, '', '拍摄日期 2026-05-24'].join(' ');
  const test = (query) => {
    const oldHit = hay.toLowerCase().includes(query);
    const flat = hay.replace(/\\s+/g, '');
    const flatQ = query.replace(/\\s+/g, '');
    const newHit = flat.toLowerCase().includes(flatQ);
    return { 旧逻辑: oldHit, 新逻辑: newHit };
  };
  return JSON.stringify({
    ocrText: ocr.text.slice(0, 70),
    搜蓝桥杯: test('蓝桥杯'),
    搜蓝桥: test('蓝桥'),
    搜蓝桥大赛: test('蓝桥大赛'),
    搜湖北大学: test('湖北大学'),
  }, null, 1);
})()`);

console.log(out);
ws.close();
