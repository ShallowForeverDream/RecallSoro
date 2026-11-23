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

console.log('=== 1. 搜索：OCR 空格文本也能搜到 ===');
console.log(await ev(`(async () => {
  const { db } = await import('/assets/' + [...document.querySelectorAll('script[type=module]')].map(s=>s.src.split('/').pop())[0]).catch(()=>({}));
  return 'skip';
})()`).catch(() => ''));

// 直接在 IndexedDB 里找带 ocrText 的 capture，验证搜索逻辑
console.log(await ev(`(async () => {
  const open = indexedDB.open('recallsoro');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
  const tx = db.transaction('captures', 'readonly');
  const caps = await new Promise((res) => { const r = tx.objectStore('captures').getAll(); r.onsuccess = () => res(r.result); });
  const withOcr = caps.filter(c => c.ocrText);
  if (!withOcr.length) return '当前库中没有已 OCR 的资料，跳过';
  const c = withOcr[0];
  const q = '蓝桥杯';
  const hay = [c.title, c.originalName, c.note, c.text||'', c.url||'', c.ocrText||'', ...c.tags, ...c.facts.map(f=>f.value)].join(' ');
  const oldHit = hay.toLowerCase().includes(q);
  const flat = hay.replace(/\\\\s+/g, '');
  const flatQ = q.replace(/\\\\s+/g, '');
  const newHit = flat.toLowerCase().includes(flatQ);
  return JSON.stringify({ ocrSample: c.ocrText.slice(0,60), query: q, 旧逻辑命中: oldHit, 新逻辑命中: newHit });
})()`));

console.log('\n=== 2. 佐证上传后的字段洁净度 ===');
console.log(await ev(`(async () => {
  const open = indexedDB.open('recallsoro');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
  const tx = db.transaction('experiences', 'readonly');
  const exps = await new Promise((res) => { const r = tx.objectStore('experiences').getAll(); r.onsuccess = () => res(r.result); });
  const dirty = exps.filter(e => {
    const cf = e.customFields || {};
    return Object.entries(cf).some(([k, v]) => /待补|待上传|待关联/.test(v || '') && /\\.jpg|\\.png|\\.jpeg/i.test(v || ''));
  });
  return JSON.stringify({ total: exps.length, 残留占位文案的记录数: dirty.length });
})()`));

console.log('\n=== 3. 导出菜单可用性 ===');
await ev(`(() => { const href = document.querySelector('.nav-item-pinned')?.getAttribute('href'); if (href) { history.pushState({}, '', href); window.dispatchEvent(new PopStateEvent('popstate')); } return 'ok'; })()`);
await sleep(1500);
console.log(await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '导出');
  if (!b) return '无导出按钮';
  b.click();
  return '已打开导出菜单';
})()`));
await sleep(500);
console.log('导出项:', await ev("[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>/导出|打包/.test(t)).join(' || ')"));

console.log('\n=== 4. 分级筛选（含未列入目录）===');
console.log(await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /未列入目录 \\(\\d+\\)/.test(x.textContent));
  if (!b) return '未找到「未列入目录」筛选按钮';
  const label = b.textContent.trim();
  b.click();
  return label;
})()`));
await sleep(800);
console.log('筛选后行数:', await ev("document.querySelectorAll('tbody tr').length"));

ws.close();
