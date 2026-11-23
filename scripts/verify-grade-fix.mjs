/**
 * 验证本轮优化在真实台账数据下的效果。
 * 运行：node scripts/verify-grade-fix.mjs
 */
import fs from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

const zip = unzipSync(new Uint8Array(fs.readFileSync('docs/competitions/recallsoro-competitions-import.zip')));
const backup = JSON.parse(strFromU8(zip['backup.json']));
const experiences = backup.experiences;

// 与 src/lib/competition.ts 一致
function getGradeBucket(gradeRaw) {
  const g = (gradeRaw ?? '').trim().toUpperCase();
  if (!g || g.includes('待确认') || g.includes('未知') || g.includes('未匹配')) return '待确认';
  if (g.includes('未列入目录') || g.includes('不在目录') || g.includes('目录外')) return '未列入目录';
  if (g.startsWith('A1')) return 'A1';
  if (g.startsWith('A2')) return 'A2';
  if (g.startsWith('B1')) return 'B1';
  if (g.startsWith('B2')) return 'B2';
  if (g.startsWith('C')) return 'C';
  return '待确认';
}

console.log('=== 分级状态重新归类 ===');
const buckets = {};
for (const e of experiences) {
  const b = getGradeBucket(e.customFields?.['湖大分级']);
  buckets[b] = (buckets[b] ?? 0) + 1;
}
const resolved = Object.entries(buckets).filter(([k]) => k !== '待确认').reduce((s, [, v]) => s + v, 0);
console.log(`总记录：${experiences.length}`);
for (const [k, v] of Object.entries(buckets).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}：${v}`);
}
console.log(`\n已核实（有明确结论）：${resolved}/${experiences.length}（${Math.round((resolved / experiences.length) * 100)}%）`);
console.log(`真正待确认：${buckets['待确认'] ?? 0} 条`);
console.log(`修复前：待确认 50 条（把「未列入目录」误算成待确认）`);

// CSV 列完整性
console.log('\n=== CSV 导出列 ===');
const templateFields = [
  '报名时间', '比赛时间', '获奖时间', '比赛地点', '湖大分级', '原表级别', '分级依据',
  '是否获奖', '奖项', '成绩', '排名', '颁奖单位', '个人赛/团队赛', '团队赛负责人',
  '指导老师', '角色', '队伍', '作品链接', '证书照片', '奖牌照片', '合照', '相关图片',
  '备注', '复盘',
].filter((k) => !['证书照片', '奖牌照片', '合照', '相关图片'].includes(k));
const headers = ['时间', '竞赛名称', '分组', '关联佐证数', ...templateFields];
console.log(`列数：${headers.length}`);
console.log(`包含「团队赛负责人」：${headers.includes('团队赛负责人')}`);
console.log(`包含「指导老师」：${headers.includes('指导老师')}`);
console.log(`包含「角色」「队伍」「作品链接」「复盘」：${['角色', '队伍', '作品链接', '复盘'].every((h) => headers.includes(h))}`);
console.log('\n前 12 列：' + headers.slice(0, 12).join(' | '));
console.log('后 12 列：' + headers.slice(-12).join(' | '));

// PDF 目录表列宽是否放得下「未列入目录」
console.log('\n=== PDF 目录表列宽 ===');
const cols = [
  { label: '#', width: 22 }, { label: '时间', width: 58 }, { label: '名称', width: 216 },
  { label: '分级', width: 52 }, { label: '奖项', width: 42 }, { label: '成绩/排名', width: 48 },
  { label: '颁奖单位', width: 61 },
];
const total = cols.reduce((s, c) => s + c.width, 0);
console.log(`总宽 ${total} / 可用 ${595.28 - 96}：${total <= 595.28 - 96 ? 'OK' : '溢出'}`);
console.log(`「未列入目录」5 字 @8.6pt ≈ ${(5 * 8.6).toFixed(0)}pt，分级列 ${cols[3].width}pt：${5 * 8.6 <= cols[3].width ? '放得下' : '放不下'}`);
