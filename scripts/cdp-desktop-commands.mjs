import fs from 'node:fs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64 = fs.readFileSync('D:/0tools/cert-test.b64', 'utf8').trim();

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
await sleep(800);

console.log('has Tauri invoke:', await ev("typeof window.__TAURI_INTERNALS__?.invoke === 'function'"));

console.log('\n=== 1. 保存测试图片到本地原件库 ===');
console.log(await ev(`(async () => { try { const r = await window.__TAURI_INTERNALS__.invoke('save_blob_base64', { dataBase64: ${JSON.stringify(b64)} }); return JSON.stringify(r); } catch (e) { return 'ERR: ' + String(e); } })()`));

await ev(`(async () => { window.__SHA = (await window.__TAURI_INTERNALS__.invoke('save_blob_base64', { dataBase64: ${JSON.stringify(b64)} })).sha256; return 'ok'; })()`);

console.log('\n=== 2. OCR 命令（真实桌面端） ===');
console.log(await ev(`(async () => { try { const r = await window.__TAURI_INTERNALS__.invoke('ocr_blob_windows', { sha256: window.__SHA, lang: 'zh-Hans-CN' }); return JSON.stringify({ engine: r.engine, width: r.width, height: r.height, text: r.text.slice(0, 120), sensitive: r.sensitive }, null, 1); } catch (e) { return 'ERR: ' + String(e); } })()`));

console.log('\n=== 3. 账本落盘 ===');
console.log(await ev(`(async () => { try { const r = await window.__TAURI_INTERNALS__.invoke('write_ledger_snapshot', { jsonText: JSON.stringify({ app: 'RecallSoro', savedAt: new Date().toISOString(), experiences: [{ id: 'test-1', title: '端到端测试记录' }] }) }); return JSON.stringify(r); } catch (e) { return 'ERR: ' + String(e); } })()`));

console.log('\n=== 4. 读取账本 ===');
console.log(await ev(`(async () => { try { return await window.__TAURI_INTERNALS__.invoke('read_ledger_snapshot'); } catch (e) { return 'ERR: ' + String(e); } })()`));

console.log('\n=== 5. 历史版本 ===');
console.log(await ev(`(async () => { try { return JSON.stringify(await window.__TAURI_INTERNALS__.invoke('list_ledger_versions')); } catch (e) { return 'ERR: ' + String(e); } })()`));

console.log('\n=== 6. 中文字体 ===');
console.log(await ev(`(async () => { try { const f = await window.__TAURI_INTERNALS__.invoke('read_cjk_font_base64'); return 'base64 length = ' + f.length; } catch (e) { return 'ERR: ' + String(e); } })()`));

console.log('\n=== 7. 存储信息 ===');
console.log(await ev(`(async () => { try { return JSON.stringify(await window.__TAURI_INTERNALS__.invoke('get_storage_info')); } catch (e) { return 'ERR: ' + String(e); } })()`));

console.log('\n=== 8. 回滚测试 ===');
console.log(await ev(`(async () => { try { const vs = await window.__TAURI_INTERNALS__.invoke('list_ledger_versions'); if (!vs.length) return 'no versions'; const r = await window.__TAURI_INTERNALS__.invoke('restore_ledger_version', { versionPath: vs[vs.length-1].path }); return JSON.stringify(r); } catch (e) { return 'ERR: ' + String(e); } })()`));

ws.close();
