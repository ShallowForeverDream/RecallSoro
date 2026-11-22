const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const targets = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
const page = targets.find((t) => t.type === 'page' && t.url.includes('127.0.0.1:4173'));
if (!page) throw new Error('smoke-test page not found');

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (reply.result?.exceptionDetails) throw new Error(reply.result.exceptionDetails.text);
  return reply.result?.result?.value;
};

await send('Runtime.enable');
await sleep(800);
console.log('title:', await evaluate('document.title'));
console.log('heading:', await evaluate("document.querySelector('h1')?.textContent"));

await evaluate(`(() => {
  const t = document.querySelector('textarea');
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  setter.call(t, '2026 年 3 月参加了学校创新创业比赛 #测试');
  t.dispatchEvent(new Event('input', { bubbles: true }));
  return t.value;
})()`);
await sleep(250);
await evaluate("(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('收进收件箱')); if (!b) return false; b.click(); return true; })()");
await sleep(1200);

const visible = await evaluate("document.body.innerText.includes('创新创业比赛')");
const count = await evaluate(`new Promise(resolve => {
  const req = indexedDB.open('recallsoro');
  req.onsuccess = () => {
    const tx = req.result.transaction('captures', 'readonly');
    const c = tx.objectStore('captures').count();
    c.onsuccess = () => resolve(c.result);
  };
})`);
const tag = await evaluate("document.body.innerText.includes('#测试') || document.body.innerText.includes('测试')");

console.log('note rendered:', visible);
console.log('captures in IndexedDB:', count);
console.log('tag or extracted text rendered:', tag);

await evaluate("document.querySelector('.capture-card')?.click()");
await sleep(500);
const modalOpened = await evaluate("!!document.querySelector('.modal')");
await evaluate("(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('创建经历')); if (!b) return false; b.click(); return true; })()");
await sleep(900);
const path = await evaluate('location.pathname');
const expCount = await evaluate(`new Promise(resolve => {
  const req = indexedDB.open('recallsoro');
  req.onsuccess = () => {
    const c = req.result.transaction('experiences', 'readonly').objectStore('experiences').count();
    c.onsuccess = () => resolve(c.result);
  };
})`);
console.log('detail modal opened:', modalOpened);
console.log('route after create experience:', path);
console.log('experiences in IndexedDB:', expCount);
ws.close();
