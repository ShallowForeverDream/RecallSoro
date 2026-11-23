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

const out = await ev(`(async () => {
  const captured = { blob: null, name: '' };
  const origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (blob) { captured.blob = blob; return origCreate(blob); };
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { captured.name = this.download || captured.name; };

  const steps = [];
  const clickText = (re, sel = 'button') => {
    const b = [...document.querySelectorAll(sel)].find(x => re.test(x.textContent.trim()));
    if (b) { b.click(); return true; }
    return false;
  };

  // 1. 进入「全部竞赛经历」台账详情
  const href = [...document.querySelectorAll('.nav-item-pinned')][0]?.getAttribute('href');
  steps.push('定位:' + (href || 'none'));
  history.pushState({}, '', href || '/collections/collection-all-competitions');
  window.dispatchEvent(new PopStateEvent('popstate'));
  await new Promise(r => setTimeout(r, 1600));

  // 2. 打开导出菜单
  steps.push('导出:' + clickText(/^导出$/));
  await new Promise(r => setTimeout(r, 500));

  // 3. 选择 PDF 证明册
  steps.push('PDF:' + clickText(/导出 PDF 证明册/));
  await new Promise(r => setTimeout(r, 900));

  // 4. 确认生成
  steps.push('确认:' + clickText(/立即生成证明册|确认生成|生成证明/));
  await new Promise(r => setTimeout(r, 10000));

  if (!captured.blob) {
    return JSON.stringify({ ok: false, steps, url: location.pathname, toasts: [...document.querySelectorAll('[class*=toast]')].map(e=>e.textContent.trim()).join('|') });
  }
  const buf = new Uint8Array(await captured.blob.arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return JSON.stringify({
    ok: true, steps, name: captured.name, type: captured.blob.type,
    size: buf.length, head: String.fromCharCode(buf[0],buf[1],buf[2],buf[3]),
    b64: btoa(bin),
  });
})()`);

const parsed = JSON.parse(out);
console.log('步骤:', (parsed.steps || []).join(' | '));
if (parsed.ok) {
  console.log('文件名:', parsed.name);
  console.log('MIME:', parsed.type, '| 大小:', parsed.size, '字节');
  console.log('文件头:', parsed.head, '=> 合法 PDF:', parsed.head === '%PDF');
  fs.writeFileSync('D:/0tools/proof-export.pdf', Buffer.from(parsed.b64, 'base64'));
  console.log('已保存 D:/0tools/proof-export.pdf');
} else {
  console.log('失败:', parsed.reason || '未知', '| url:', parsed.url, '| toasts:', parsed.toasts);
}
ws.close();
