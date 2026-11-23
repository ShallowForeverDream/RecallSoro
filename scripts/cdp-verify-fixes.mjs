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
await sleep(700);

const zipB64 = fs.readFileSync('docs/competitions/recallsoro-competitions-import.zip').toString('base64');

// 1) 导入台账
console.log('=== 导入台账 ===');
console.log(await ev(`(async () => {
  const bin = atob(${JSON.stringify(zipB64)});
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const file = new File([arr], 'recallsoro-competitions-import.zip', { type: 'application/zip' });
  const input = document.querySelector('input[type=file][accept=".zip"]');
  if (!input) return 'no input';
  const dt = new DataTransfer(); dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'dispatched';
})()`));
await sleep(5000);

// 2) 打开台账详情看缺证书数字
console.log('\n=== 台账详情 KPI ===');
await ev(`(() => {
  const href = document.querySelector('.nav-item-pinned')?.getAttribute('href');
  if (href) { history.pushState({}, '', href); window.dispatchEvent(new PopStateEvent('popstate')); }
  return 'ok';
})()`);
await sleep(1800);
const kpi = await ev(`(() => {
  const t = document.body.innerText;
  const m = t.match(/台账总计[\\s\\S]{0,200}/);
  return m ? m[0] : t.slice(0, 300);
})()`);
console.log(kpi.replace(/\n+/g, ' | '));

// 3) 缺证书筛选
console.log('\n=== 缺证书筛选 ===');
const filtered = await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /缺证书 \\(\\d+\\)/.test(x.textContent));
  if (!b) return 'no filter button';
  const label = b.textContent.trim();
  b.click();
  return label;
})()`);
console.log('点击筛选:', filtered);
await sleep(900);
const rowInfo = await ev(`(() => {
  const rows = document.querySelectorAll('tbody tr');
  const chips = [...document.querySelectorAll('.cell-evidence')].slice(0, 3).map(e => e.textContent.trim().replace(/\\s+/g,' '));
  return JSON.stringify({ rows: rows.length, firstChips: chips });
})()`);
console.log('筛选结果:', rowInfo);

// 4) 档案总览
console.log('\n=== 档案总览 ===');
await ev(`(() => { history.pushState({}, '', '/dashboard'); window.dispatchEvent(new PopStateEvent('popstate')); return 'ok'; })()`);
await sleep(1600);
const dash = await ev(`(() => {
  const t = document.body.innerText;
  const m = t.match(/待补齐证书[\\s\\S]{0,80}/);
  return m ? m[0].replace(/\\n+/g, ' | ') : 'not found';
})()`);
console.log(dash);

// 5) 打开一条记录的快编抽屉，看是否定位到缺失槽位
console.log('\n=== 快编抽屉槽位定位 ===');
await ev(`(() => { history.pushState({}, '', document.querySelector('.nav-item-pinned')?.getAttribute('href') || '/collections'); window.dispatchEvent(new PopStateEvent('popstate')); return 'ok'; })()`);
await sleep(1500);
const drawer = await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '快编');
  if (!b) return 'no quick-edit button';
  b.click();
  return 'clicked';
})()`);
console.log('点击快编:', drawer);
await sleep(900);
const slotInfo = await ev(`(() => {
  const t = document.body.innerText;
  const m = t.match(/快速补传佐证[\\s\\S]{0,200}/);
  return m ? m[0].replace(/\\n+/g, ' | ') : 'drawer not found';
})()`);
console.log(slotInfo);

ws.close();
