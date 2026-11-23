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
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600));
  return r.result?.result?.value;
};
await send('Runtime.enable');
await sleep(700);

const b64 = fs.readFileSync('D:/0tools/cert-test.b64', 'utf8').trim();

const out = await ev(`(async () => {
  const saved = await window.__TAURI_INTERNALS__.invoke('save_blob_base64', { dataBase64: ${JSON.stringify(b64)} });
  const ocr = await window.__TAURI_INTERNALS__.invoke('ocr_blob_windows', { sha256: saved.sha256, lang: 'zh-Hans-CN' });

  const open = indexedDB.open('recallsoro');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
  const tx = db.transaction('experiences', 'readonly');
  const experiences = await new Promise((res) => { const r = tx.objectStore('experiences').getAll(); r.onsuccess = () => res(r.result); });

  const tokenize = (text) => {
    const cleaned = text.toLowerCase().replace(/[^\\u4e00-\\u9fa5a-z0-9]+/g, ' ').trim();
    const tokens = new Set();
    for (const part of cleaned.split(/\\s+/)) {
      if (part.length >= 2) tokens.add(part);
      if (/^[\\u4e00-\\u9fa5]{4,}$/.test(part)) for (let i = 0; i <= part.length - 2; i++) tokens.add(part.slice(i, i+2));
    }
    return Array.from(tokens);
  };
  const tokenizeOcr = (text) => {
    const tokens = new Set();
    const chars = text.replace(/\\s+/g, '');
    for (let i = 0; i <= chars.length - 2; i++) { const p = chars.slice(i,i+2); if (/[\\u4e00-\\u9fa5]{2}/.test(p)) tokens.add(p); }
    for (const part of text.toLowerCase().split(/[\\s,，。；;、]+/)) {
      const clean = part.replace(/[^\\u4e00-\\u9fa5a-z0-9]/g, '');
      if (clean.length >= 2) { tokens.add(clean); if (/^[\\u4e00-\\u9fa5]{4,}$/.test(clean)) for (let i=0;i<=clean.length-2;i++) tokens.add(clean.slice(i,i+2)); }
    }
    return Array.from(tokens);
  };
  const GENERIC = new Set(['湖北','北大','大学','学院','第十','第九','第八','第七','第六','第五','第一','第二','第三','第四','届','获奖','证书','荣誉','兹有','同学','一等','二等奖','等第','等奖','金奖','银奖','铜奖','优胜','优秀','参赛','获奖证书','决定','兹','者','序号','专业','国家','中国']);

  const capTokens = new Set(tokenizeOcr(ocr.text));
  // 与 src/lib/intelligence.ts 的 extractAwardFromText 保持一致
  const AWARD_RE = /(特等奖|一等奖|二等奖|三等奖|金奖|银奖|铜奖|优胜奖|优秀奖|国一|国二|国三|省一|省二|省三)/;
  const compactOcr = ocr.text.replace(/\\s+/g, '');
  let capAward = (compactOcr.match(AWARD_RE) || [])[1];
  if (!capAward) { const sh = compactOcr.match(/(国|省)([一二三123])/); if (sh) capAward = sh[1] + sh[2]; }
  const results = [];
  for (const exp of experiences) {
    const cf = exp.customFields || {};
    const expTokens = new Set([
      ...tokenize(exp.title || ''),
      ...tokenizeOcr(cf['奖项'] || ''),
      ...tokenizeOcr(cf['颁奖单位'] || ''),
      ...tokenize((exp.tags || []).join(' ')),
    ]);
    const matched = [];
    for (const tok of expTokens) {
      if (tok.length >= 2 && capTokens.has(tok) && !/^(全国|中国|大学|大学生|竞赛|比赛|证书|照片|奖|一等奖|二等奖|三等奖)$/.test(tok)) matched.push(tok);
    }
    if (!matched.length) continue;
    const generic = matched.filter(t => GENERIC.has(t));
    const specific = matched.filter(t => !GENERIC.has(t));
    let score = Math.min(60, specific.length * 8 + generic.length);
    if (specific.length >= 2) score += 16;
    const award = (cf['奖项'] || '').trim();
    if (capAward && award && award.includes(capAward)) score += 18;
    const grade = (cf['湖大分级'] || '').trim();
    if (grade && grade !== '待确认' && grade !== '未列入目录') score += 6;
    if (score >= 32) results.push({ title: exp.title, grade, award, score, specific: specific.slice(0,5), generic: generic.slice(0,3) });
  }
  results.sort((a,b) => b.score - a.score);
  return JSON.stringify({ ocr: ocr.text.slice(0,80), capAward, total: results.length, top: results.slice(0,6) }, null, 1);
})()`);

const parsed = JSON.parse(out);
console.log('OCR 文本:', parsed.ocr);
console.log('识别到的奖项:', parsed.capAward);
console.log(`达到阈值的候选：${parsed.total} 条\n`);
console.log('排序：');
parsed.top.forEach((r, i) => {
  console.log(`  ${i + 1}. [${r.score}分] ${r.title}`);
  console.log(`      分级:${r.grade} 奖项:${r.award}`);
  console.log(`      核心词:${r.specific.join('、') || '（无）'} 通用词:${r.generic.join('、') || '（无）'}`);
});
ws.close();
