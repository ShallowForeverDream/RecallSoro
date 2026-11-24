import http from 'node:http';
import { spawn } from 'node:child_process';

const mock = http.createServer((req, res) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      model: 'mock-v1',
      choices: [{ message: { content: JSON.stringify({
        title: '蓝桥杯全国软件和信息技术专业人才大赛软件赛C/C++省赛',
        award: '省一', score: '360分', rank: '1/279',
        issuer: '蓝桥杯大赛组委会', awardDate: '2025-04-29', grade: '省级'
      }) } }]
    }));
  });
});
await new Promise((r) => mock.listen(18765, '127.0.0.1', r));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t = await fetch('http://127.0.0.1:9333/json').then((r) => r.json());
const p = t.find((x) => x.type === 'page');
const ws = new WebSocket(p.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let i = 0;
const q = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && q.has(m.id)) { q.get(m.id)(m); q.delete(m.id); } };
const s = (method, params = {}) => new Promise((res) => { const id = ++i; q.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (x) => {
  const r = await s('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return 'ERR ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400);
  return r.result?.result?.value;
};
await s('Runtime.enable');
await sleep(500);

console.log('=== 候选表物理隔离验证 ===');
console.log(await ev(`(async () => {
  const open = indexedDB.open('recallsoro');
  const db = await new Promise((res,rej)=>{open.onsuccess=()=>res(open.result);open.onerror=()=>rej(open.error)});
  const names = Array.from(db.objectStoreNames);
  const tx = db.transaction(['experiences','candidates'],'readonly');
  const exps = await new Promise((res)=>{const q=tx.objectStore('experiences').getAll();q.onsuccess=()=>res(q.result)});
  const cands = await new Promise((res)=>{const q=tx.objectStore('candidates').getAll();q.onsuccess=()=>res(q.result)});
  // 模拟一次抽取写入候选（不调 AI，直接构造）
  const c = {
    id: crypto.randomUUID(), captureId: 'test-cap', provider:'custom', model:'mock-v1',
    payloadHash:'abc', fields:{ '奖项':{value:'省一',confidence:0.8} },
    overallConfidence:0.7, status:'pending', createdAt:new Date().toISOString()
  };
  const wtx = db.transaction('candidates','readwrite');
  wtx.objectStore('candidates').put(c);
  await new Promise((res)=>{wtx.oncomplete=res});
  const expsAfter = await new Promise((res)=>{const q=db.transaction('experiences').objectStore('experiences').getAll();q.onsuccess=()=>res(q.result)});
  return JSON.stringify({
    objectStores: names,
    candidatesBefore: cands.length,
    candidatesAfter: (await new Promise((res)=>{const q=db.transaction('candidates').objectStore('candidates').getAll();q.onsuccess=()=>res(q.result)})).length,
    experiencesBefore: exps.length,
    experiencesAfter: expsAfter.length,
    候选写入未触碰经历: exps.length === expsAfter.length
  });
})()`));

ws.close();
mock.close();
