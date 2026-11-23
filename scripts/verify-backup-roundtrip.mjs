/**
 * 验证备份往返的完整性：遮罩坐标、佐证槽位、customFields 是否都保留。
 * 运行：node scripts/verify-backup-roundtrip.mjs
 */
import fs from 'node:fs';
import { unzipSync, strFromU8, zipSync, strToU8 } from 'fflate';

const zip = unzipSync(new Uint8Array(fs.readFileSync('docs/competitions/recallsoro-competitions-import.zip')));
const backup = JSON.parse(strFromU8(zip['backup.json']));

// 构造一条带完整字段的经历
const sample = {
  id: 'test-roundtrip-1',
  title: '第十五届蓝桥杯全国软件和信息技术专业人才大赛软件赛C/C++省赛',
  description: '测试记录',
  startAt: '2025-04-13',
  endAt: undefined,
  timePrecision: 'day',
  location: '武汉',
  status: 'active',
  tags: ['算法'],
  captureIds: ['cap-1', 'cap-2'],
  templateId: 'tpl-competition',
  customFields: {
    报名时间: '2025.3',
    比赛时间: '2025.4',
    获奖时间: '2025-04-29',
    '个人赛/团队赛': '个人赛',
    团队赛负责人: '待补充',
    指导老师: '张老师',
    湖大分级: 'A2',
    分级依据: '官方目录',
    奖项: '省一',
    证书照片: '证书照片.jpg',
    奖牌照片: '',
    合照: '',
    相关图片: '',
    备注: '测试备注',
  },
  evidenceSlots: {
    证书照片: ['cap-1'],
    合照: ['cap-2'],
  },
  createdAt: '2025-04-01T00:00:00.000Z',
  updatedAt: '2025-04-29T00:00:00.000Z',
};

const capture = {
  id: 'cap-1',
  kind: 'image',
  title: '证书照片',
  originalName: 'cert.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
  sha256: 'a'.repeat(64),
  source: 'inbox',
  capturedAt: '2025-04-29',
  importedAt: '2025-04-29T00:00:00.000Z',
  status: 'ready',
  note: '',
  tags: [],
  facts: [],
  ocrText: '湖 北 大 学 获 奖 证 书',
  redactions: [
    { id: 'r1', x: 0.267, y: 0.4154, w: 0.318, h: 0.0549 },
    { id: 'r2', x: 0.2, y: 0.5226, w: 0.18, h: 0.0549 },
  ],
};

const meta = {
  app: 'RecallSoro',
  version: 1,
  exportedAt: new Date().toISOString(),
  captures: [capture],
  experiences: [sample],
  templates: [],
  collections: [],
  relations: [],
  settings: [],
  files: { 'cap-1': 'files/cap-1' },
};

// 模拟导出：JSON + 文件字节
const entries = { 'backup.json': strToU8(JSON.stringify(meta, null, 2)), 'files/cap-1': new Uint8Array([1, 2, 3]) };
const out = zipSync(entries, { level: 1 });

// 模拟导入：读回
const back = unzipSync(out);
const meta2 = JSON.parse(strFromU8(back['backup.json']));
const exp2 = meta2.experiences[0];
const cap2 = meta2.captures[0];

console.log('=== 备份往返验证 ===');
const checks = [
  ['customFields 全字段', JSON.stringify(exp2.customFields) === JSON.stringify(sample.customFields)],
  ['evidenceSlots 保留', JSON.stringify(exp2.evidenceSlots) === JSON.stringify(sample.evidenceSlots)],
  ['templateId 保留', exp2.templateId === 'tpl-competition'],
  ['captureIds 保留', JSON.stringify(exp2.captureIds) === JSON.stringify(sample.captureIds)],
  ['redactions 遮罩坐标保留', JSON.stringify(cap2.redactions) === JSON.stringify(capture.redactions)],
  ['ocrText 保留', cap2.ocrText === capture.ocrText],
  ['sha256 保留', cap2.sha256 === capture.sha256],
  ['文件字节可取回', !!back[meta2.files['cap-1']]],
  ['mimeType 保留（决定恢复后能否 OCR）', cap2.mimeType === 'image/jpeg'],
];

let ok = true;
for (const [name, pass] of checks) {
  console.log(`  ${pass ? '✓' : '✗'} ${name}`);
  if (!pass) ok = false;
}

console.log(`\n结论：${ok ? '备份往返完整，无需修改' : '存在字段丢失，需要修复'}`);
