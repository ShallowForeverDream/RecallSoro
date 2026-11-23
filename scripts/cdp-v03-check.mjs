const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const targets = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
const page = targets.find((t) => t.type === 'page' && t.url.includes('127.0.0.1:4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res) => { ws.onopen = res; });
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text); return r.result?.result?.value; };
await send('Runtime.enable');
await sleep(700);
console.log('title:', await evaluate('document.title'));
console.log('nav:', await evaluate("[...document.querySelectorAll('.nav-item span')].map(e=>e.textContent).join(' | ')"));
console.log('buttons:', await evaluate("[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean).slice(0,30).join(' || ')"));
console.log('html theme:', await evaluate("document.documentElement.dataset.theme || document.documentElement.className"));

await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))");
await sleep(400);
console.log('command palette opened:', (await evaluate('document.body.innerText')).includes('快速命令'));

const scanClicked = await evaluate("(() => {const e=[...document.querySelectorAll('.nav-item,button')].find(x=>x.textContent.includes('手机扫码传图')); if(e){e.click();return true} return false})()");
await sleep(500);
const t = await evaluate('document.body.innerText');
console.log('scan entry clicked:', scanClicked, '| modal:', t.includes('扫码') || t.includes('局域网'));
ws.close();
