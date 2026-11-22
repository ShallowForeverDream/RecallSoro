import { execFileSync } from 'node:child_process';

const exe = 'D:/MY_PROJECT/codex_work_bridge/bin/codex_work_bridge.exe';
const keywords = [
  '蓝桥杯', 'CTF', '竞赛', '比赛', '获奖', '证书', '奖状', '国赛', '省赛', 'ICPC',
  '天梯赛', '百度之星', '密码数学', '网络安全', '信息安全', '机器人', '数学竞赛',
  'CET', '软考', 'NISP', 'CCF', '强网杯', '金牌', '银奖', '铜奖', '一等奖', '二等奖',
  '三等奖', '参赛', '报名', '颁奖', '决赛', '初赛', '测评', '名次', '排名',
];

const seen = new Set();
for (const kw of keywords) {
  let raw;
  try {
    raw = execFileSync(exe, ['wechat', 'search', kw, '--json'], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
  } catch (e) {
    console.log(`\n### ${kw}: ERROR ${String(e.message).slice(0, 80)}`);
    continue;
  }
  let j;
  try { j = JSON.parse(raw); } catch { console.log(`\n### ${kw}: parse error`); continue; }
  const rows = j.results ?? [];
  if (!rows.length) continue;
  console.log(`\n### ${kw} (${rows.length})`);
  let shown = 0;
  for (const r of rows) {
    const text = String(r.content ?? '').replace(/\s+/g, ' ').trim();
    const key = `${r.chat}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`- [${r.time}] ${r.chat}: ${text.slice(0, 190)}`);
    shown += 1;
    if (shown >= 10) break;
  }
}
