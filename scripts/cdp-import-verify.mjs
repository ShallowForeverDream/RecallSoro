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

const zipB64 = fs.readFileSync('docs/competitions/recallsoro-competitions-import.zip').toString('base64');

console.log('=== 导入竞赛台账包 ===');
const imported = await ev(`(async () => {
  const bin = atob(${JSON.stringify(zipB64)});
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const file = new File([arr], 'recallsoro-competitions-import.zip', { type: 'application/zip' });
  const input = document.querySelector('input[type=file][accept=".zip"]');
  if (!input) return 'no input';
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'dispatched';
})()`);
console.log('触发:', imported);
await sleep(5000);

console.log('=== 数据库核验 ===');
const check = await ev(`(async () => {
  const open = indexedDB.open('recallsoro');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
  const tx = db.transaction(['experiences','collections'], 'readonly');
  const all = await new Promise((res) => { const r = tx.objectStore('experiences').getAll(); r.onsuccess = () => res(r.result); });
  const cols = await new Promise((res) => { const r = tx.objectStore('collections').getAll(); r.onsuccess = () => res(r.result); });
  const graded = all.filter(e => (e.customFields||{})['湖大分级'] && e.customFields['湖大分级'] !== '待确认');
  const awarded = all.filter(e => (e.customFields||{})['奖项']);
  return JSON.stringify({
    total: all.length, graded: graded.length, withAward: awarded.length,
    collections: cols.map(c => ({ id: c.id, title: c.title, members: (c.memberIds||c.experienceIds||[]).length })),
    sample: graded[0] ? { title: graded[0].title, grade: graded[0].customFields['湖大分级'], award: graded[0].customFields['奖项'] } : null,
  });
})()`);
const parsed = JSON.parse(check);
console.log('经历总数:', parsed.total, '| 有分级:', parsed.graded, '| 有奖项:', parsed.withAward);
console.log('集合:', JSON.stringify(parsed.collections));
console.log('样例:', JSON.stringify(parsed.sample));
ws.close();
