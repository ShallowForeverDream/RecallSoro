import { execFileSync } from 'node:child_process';

const exe = 'D:/MY_PROJECT/codex_work_bridge/bin/codex_work_bridge.exe';
const chats = [
  'fz_zxl',
  'ICPC2026-2027沈阳邀请赛',
  '软件系统安全赛23-24号',
  '2026数字中国',
  '强网杯S10',
  '黄鹤杯江城校园新星赛决赛通知群',
  '45218254626@chatroom',
  'LiVC李胜华',
];
const re = /竞赛|比赛|蓝桥|CTF|ICPC|天梯|百度之星|码蹄|马蹄|CCF|CCSP|NISP|强网|华为杯|获奖|奖状|证书|国赛|省赛|一等奖|二等奖|三等奖|金奖|银奖|铜奖|报名|决赛|初赛|测评|晋级|名次|排名/i;

for (const chat of chats) {
  let raw;
  try {
    raw = execFileSync(exe, ['wechat', 'history', chat, '-n', '1500', '--json'], { encoding: 'utf8', maxBuffer: 60 * 1024 * 1024 });
  } catch (e) {
    console.log(`\n### ${chat}: ERROR ${String(e.message).slice(0, 90)}`);
    continue;
  }
  let j;
  try { j = JSON.parse(raw); } catch { console.log(`\n### ${chat}: parse error`); continue; }
  const msgs = j.messages ?? j.results ?? j.history ?? [];
  const mine = msgs.filter((m) => {
    const sender = String(m.sender ?? m.from ?? '');
    const isMine = sender === '' || sender === '浅叶梦缘' || sender.includes('朱俊好');
    return isMine && re.test(String(m.content ?? ''));
  });
  console.log(`\n### ${chat}: total=${msgs.length} mine_matches=${mine.length}`);
  for (const m of mine.slice(0, 20)) {
    const text = String(m.content ?? '').replace(/\s+/g, ' ').trim();
    console.log(`- [${m.time ?? ''}] ${text.slice(0, 200)}`);
  }
}
