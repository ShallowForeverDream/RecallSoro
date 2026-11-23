/**
 * 用真实竞赛台账数据验证本轮修复（与 src/lib/competition.ts 逻辑保持一致）。
 * 运行：node scripts/verify-fixes.mjs
 */
import fs from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

const zip = unzipSync(new Uint8Array(fs.readFileSync('docs/competitions/recallsoro-competitions-import.zip')));
const backup = JSON.parse(strFromU8(zip['backup.json']));
const experiences = backup.experiences;

const EVIDENCE_SLOTS = ['证书照片', '奖牌照片', '合照', '相关图片'];
const PLACEHOLDER_RE = /待补|待上传|未上传|待关联|待填写|待确认|暂无|尚未|无|缺/;
const hasRealEvidenceText = (t) => {
  const v = (t ?? '').trim();
  return Boolean(v && !PLACEHOLDER_RE.test(v));
};
const isAwarded = (exp) => {
  const cf = exp.customFields ?? {};
  const flag = (cf['是否获奖'] ?? '').trim();
  const award = (cf['奖项'] ?? '').trim();
  if (flag === '是' || flag === '已获奖') return true;
  if (flag === '否' || flag === '未获奖') return false;
  return Boolean(award && !/无|未获|待核实|参与/.test(award));
};

function audit(exp) {
  const awarded = isAwarded(exp);
  const slotFilled = {};
  const missingSlots = [];
  for (const slot of EVIDENCE_SLOTS) {
    const ids = exp.evidenceSlots?.[slot] ?? [];
    const filled = ids.length > 0 || hasRealEvidenceText(exp.customFields?.[slot]);
    slotFilled[slot] = filled;
    if (!filled) missingSlots.push(slot);
  }
  return { awarded, missingCertificate: awarded && !slotFilled['证书照片'], slotFilled, missingSlots };
}

console.log(`台账经历数：${experiences.length}\n`);
console.log('=== 1. 缺证书体检（修复后真实值）===');
const awarded = experiences.filter((e) => isAwarded(e));
const missing = awarded.filter((e) => audit(e).missingCertificate);
console.log(`获奖记录：${awarded.length} 条`);
console.log(`缺证书：${missing.length} 条（修复前显示假的 0）`);
console.log(`已挂证书：${awarded.length - missing.length} 条`);
const slotStats = {};
for (const e of experiences) {
  const a = audit(e);
  for (const s of EVIDENCE_SLOTS) {
    slotStats[s] = slotStats[s] ?? { ok: 0, missing: 0 };
    if (a.slotFilled[s]) slotStats[s].ok += 1;
    else slotStats[s].missing += 1;
  }
}
console.log('\n逐槽位统计：');
for (const s of EVIDENCE_SLOTS) console.log(`  ${s}：已有 ${slotStats[s].ok} / 缺 ${slotStats[s].missing}`);

console.log('\n=== 2. 快编按钮定位的首个缺失槽位 ===');
const counts = {};
for (const e of experiences) {
  const a = audit(e);
  const first = a.missingSlots[0] ?? '（无缺失）';
  counts[first] = (counts[first] ?? 0) + 1;
}
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}：${v} 条`);
}
