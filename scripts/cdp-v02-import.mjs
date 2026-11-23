import fs from 'node:fs';

const targets = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
const page = targets.find((t) => t.type === 'page' && t.url.includes('127.0.0.1:4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res) => { ws.onopen = res; });
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text); return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Runtime.enable');
await evaluate("location.href='http://127.0.0.1:4173/collections'");
await sleep(600);
console.log('file inputs:', await evaluate("[...document.querySelectorAll('input[type=file]')].map((e,i)=>i+':'+(e.accept||'')).join(',')"));

const { root } = (await send('DOM.getDocument')).result;
const { nodeId } = (await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' })).result;
if (!nodeId) throw new Error('file input not found');
const files = ['D:/MY_PROJECT/RecallSoro/docs/competitions/recallsoro-competitions-import.zip'];
await send('DOM.setFileInputFiles', { nodeId, files });
await sleep(1500);
const text = await evaluate('document.body.innerText');
console.log('has 98 records:', /98/.test(text));
console.log('has health check:', text.includes('缺项体检'));
console.log('has quick image:', text.includes('快速补图'));
console.log('body excerpt:', text.slice(0, 1200));
ws.close();
