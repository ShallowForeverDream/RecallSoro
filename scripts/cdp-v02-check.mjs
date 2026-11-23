const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const targets = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
const page = targets.find((t) => t.type === 'page' && t.url.includes('127.0.0.1:4173'));
if (!page) throw new Error('page not found');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
  return r.result?.result?.value;
};
await send('Runtime.enable');
await sleep(800);
console.log('title:', await evaluate('document.title'));
console.log('nav:', await evaluate("[...document.querySelectorAll('.nav-item span')].map(e=>e.textContent).join(' | ')"));
await evaluate("location.href='http://127.0.0.1:4173/collections'");
await sleep(1000);
const text = await evaluate('document.body.innerText');
console.log('collections heading:', text.includes('台账与模板') || text.includes('模板视图'));
console.log('has incremental import button:', text.includes('增量导入台账 ZIP'));
console.log('has health check:', text.includes('缺项体检'));
console.log('has quick image:', text.includes('快速补图'));
ws.close();
