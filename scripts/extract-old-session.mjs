import fs from 'node:fs';

const lines = fs.readFileSync('.oldsession.jsonl', 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const sections = [];
for (const ev of lines) {
  if (ev.type !== 'user/message') continue;
  const text = ev.data?.content?.map((c) => c.text ?? '').join('') ?? '';
  if (!text.startsWith('Background subagent')) continue;
  const marker = 'Its closing message:';
  const i = text.indexOf(marker);
  if (i < 0) continue;
  const name = text.match(/Background subagent (\S+) finished/)?.[1] ?? 'subagent';
  sections.push({ name, body: text.slice(i + marker.length).trim() });
}

const assistant = [];
for (const ev of lines) {
  if (ev.type !== 'assistant/message') continue;
  const blocks = ev.data?.message?.content ?? [];
  const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (text && ev.data.turn >= 8) assistant.push({ turn: ev.data.turn, step: ev.data.step, text });
}

let out = '# 历史会话完整调研结论\n\n';
out += '来源：`session-20a49658-23b8-4caa-94c4-cecfee67f99c`。\n\n';
out += '以下 7 路调研结果由该会话的子代理通过 `gh api` 逐库核实，原样沉淀，供 RecallSoro 后续版本参考。\n\n';
for (const s of sections) {
  out += `## 子代理：${s.name}\n\n${s.body}\n\n`;
}
out += '## 会话后期结论摘录\n\n';
for (const a of assistant) {
  out += `### turn ${a.turn} step ${a.step}\n\n${a.text}\n\n`;
}

fs.writeFileSync('docs/research/open-source-research-full.md', out);
console.log('sections', sections.length, 'assistant notes', assistant.length, 'bytes', out.length);
