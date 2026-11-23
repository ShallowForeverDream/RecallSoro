import { zipSync, strToU8 } from 'fflate';
import type { Capture, Experience } from '../types';
import { downloadBlob } from './utils';
import { resolveCaptureBlob } from './tauriBridge';

/** 兼容中英文自定义字段键名映射 */
const FIELD_ALIASES: Record<string, string[]> = {
  报名时间: ['报名时间', 'registerTime'],
  比赛时间: ['比赛时间', 'competitionTime'],
  获奖时间: ['获奖时间', 'awardTime'],
  比赛地点: ['比赛地点', 'location'],
  湖大分级: ['湖大分级', 'hubeiLevel'],
  原表级别: ['原表级别', 'level'],
  分级依据: ['分级依据', 'officialBasis'],
  是否获奖: ['是否获奖', 'awarded'],
  奖项: ['奖项', 'award'],
  成绩: ['成绩', 'score'],
  排名: ['排名', 'rank'],
  颁奖单位: ['颁奖单位', 'issuer'],
  '个人赛/团队赛': ['个人赛/团队赛', 'eventType'],
  团队赛负责人: ['团队赛负责人', 'teamLeader'],
  指导老师: ['指导老师', 'advisor'],
  角色: ['角色', 'role'],
  队伍: ['队伍', 'team'],
  作品链接: ['作品链接', 'link'],
  证书照片: ['证书照片', 'certificate'],
  奖牌照片: ['奖牌照片', 'medal'],
  合照: ['合照', 'groupPhoto'],
  相关图片: ['相关图片', 'relatedImages'],
  备注: ['备注', 'notes'],
  复盘: ['复盘', 'review'],
};

export const EVIDENCE_SLOTS = [
  { key: '证书照片', label: '证书照片', hint: '电子证书、扫描件或获奖公示截图' },
  { key: '奖牌照片', label: '奖牌照片', hint: '奖牌、奖杯实物照' },
  { key: '合照', label: '合照', hint: '队伍合照或领奖现场照' },
  { key: '相关图片', label: '相关图片', hint: '比赛现场、作品截图或其他佐证' },
] as const;

/**
 * 判断佐证字段里是否已有「实质内容」。
 *
 * 台账里写入的是「待补：请在收件箱上传证书并关联」这类提示文案，
 * 早期只过滤「待补充|无|缺」，漏掉「待补」，导致全部获奖记录都被判为
 * 证书齐全、缺证书统计恒为 0。这里统一识别各种占位说法。
 */
const PLACEHOLDER_RE = /待补|待上传|未上传|待关联|待填写|待确认|暂无|尚未|无|缺/;

export function hasRealEvidenceText(text: string | undefined): boolean {
  const v = (text ?? '').trim();
  return Boolean(v && !PLACEHOLDER_RE.test(v));
}

export function getCompField(exp: Experience, canonicalKey: string): string {
  const cf = exp.customFields ?? {};
  const aliases = FIELD_ALIASES[canonicalKey] ?? [canonicalKey];
  for (const k of aliases) {
    const val = cf[k];
    if (val !== undefined && val !== '') return val;
  }
  return '';
}

export function setCompField(exp: Experience, canonicalKey: string, value: string): Record<string, string> {
  const next = { ...(exp.customFields ?? {}) };
  const aliases = FIELD_ALIASES[canonicalKey] ?? [canonicalKey];
  for (const k of aliases) {
    if (k !== canonicalKey && k in next) delete next[k];
  }
  next[canonicalKey] = value;
  return next;
}

export function isCompetitionExperience(exp: Experience): boolean {
  if (exp.templateId === 'tpl-competition') return true;
  const cf = exp.customFields ?? {};
  return (
    '湖大分级' in cf ||
    'hubeiLevel' in cf ||
    '奖项' in cf ||
    '是否获奖' in cf ||
    '比赛时间' in cf ||
    exp.tags.some((t) => /竞赛|算法|网安|思政|比赛/.test(t))
  );
}

export function getExperienceGroup(exp: Experience): string {
  const known = ['算法', '网安', '思政', '创新创业', '数模', '人工智能', '开发', '其他'];
  for (const tag of exp.tags) {
    if (known.includes(tag)) return tag;
  }
  return exp.tags[0] || '未分组';
}

export function getGradeBucket(gradeRaw: string): 'A1' | 'A2' | 'B1' | 'B2' | 'C' | '待确认' {
  const g = gradeRaw.trim().toUpperCase();
  if (!g || g.includes('待确认') || g.includes('未知') || g.includes('未匹配')) return '待确认';
  if (g.startsWith('A1')) return 'A1';
  if (g.startsWith('A2')) return 'A2';
  if (g.startsWith('B1')) return 'B1';
  if (g.startsWith('B2')) return 'B2';
  if (g.startsWith('C')) return 'C';
  return '待确认';
}

export function isAwarded(exp: Experience): boolean {
  const flag = getCompField(exp, '是否获奖').trim();
  const award = getCompField(exp, '奖项').trim();
  if (flag === '是' || flag === '已获奖') return true;
  if (flag === '否' || flag === '未获奖') return false;
  return Boolean(award && !/无|未获|待核实|参与/.test(award));
}

export interface CompetitionAudit {
  missingDate: boolean;
  missingGrade: boolean;
  missingCertificate: boolean;
  missingAnyEvidence: boolean;
  evidenceCount: number;
  /** 各类佐证是否齐全：证书照片 / 奖牌照片 / 合照 / 相关图片 */
  slotFilled: Record<string, boolean>;
  /** 缺失的佐证类别（中文标签） */
  missingSlots: string[];
  issues: string[];
}

export function auditCompetition(exp: Experience): CompetitionAudit {
  const missingDate = !exp.startAt || exp.timePrecision === 'unknown';
  const grade = getGradeBucket(getCompField(exp, '湖大分级'));
  const missingGrade = grade === '待确认';
  const awarded = isAwarded(exp);

  // 逐槽位判断：既看 evidenceSlots 里挂了原件，也看字段里是否已有实质内容
  const slotFilled: Record<string, boolean> = {};
  const missingSlots: string[] = [];
  for (const slot of EVIDENCE_SLOTS) {
    const ids = exp.evidenceSlots?.[slot.key] ?? [];
    const filled = ids.length > 0 || hasRealEvidenceText(getCompField(exp, slot.key));
    slotFilled[slot.key] = filled;
    if (!filled) missingSlots.push(slot.label);
  }

  // 口径：获奖记录若既没有挂到「证书照片」槽位、证书字段里也没有实际内容，
  // 就判定为缺证书。不能用 captureIds 兜底——那会把「只挂了张风景照」
  // 误判成证书齐全，从而让缺证书统计永远显示 0。
  const missingCertificate = awarded && !slotFilled['证书照片'];
  const missingAnyEvidence = exp.captureIds.length === 0;

  const issues: string[] = [];
  if (missingCertificate) issues.push('缺证书');
  if (missingDate) issues.push('时间待确认');
  if (missingGrade) issues.push('分级待确认');
  if (missingSlots.length > 0) issues.push(`缺${missingSlots.join('、')}`);

  return {
    missingDate,
    missingGrade,
    missingCertificate,
    missingAnyEvidence,
    evidenceCount: exp.captureIds.length,
    slotFilled,
    missingSlots,
    issues,
  };
}

export function gradeTone(gradeRaw: string): 'gold' | 'indigo' | 'emerald' | 'warn' | 'neutral' {
  const bucket = getGradeBucket(gradeRaw);
  if (bucket === 'A1') return 'gold';
  if (bucket === 'A2') return 'indigo';
  if (bucket === 'B1' || bucket === 'B2') return 'emerald';
  if (bucket === '待确认') return 'warn';
  return 'neutral';
}

function escapeCsvCell(v: string): string {
  const s = (v ?? '').replace(/\r?\n/g, ' ');
  if (/[",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportCompetitionCSV(experiences: Experience[], filenamePrefix = '竞赛台账') {
  const headers = [
    '时间',
    '竞赛名称',
    '分组',
    '湖大分级',
    '原表级别',
    '是否获奖',
    '奖项',
    '成绩',
    '排名',
    '个人赛/团队赛',
    '指导老师',
    '比赛地点',
    '颁奖单位',
    '报名时间',
    '比赛时间',
    '获奖时间',
    '分级依据',
    '关联佐证数',
    '备注',
  ];

  const rows = experiences.map((e) => [
    e.startAt ?? '待确认',
    e.title,
    getExperienceGroup(e),
    getCompField(e, '湖大分级'),
    getCompField(e, '原表级别'),
    getCompField(e, '是否获奖'),
    getCompField(e, '奖项'),
    getCompField(e, '成绩'),
    getCompField(e, '排名'),
    getCompField(e, '个人赛/团队赛'),
    getCompField(e, '指导老师'),
    getCompField(e, '比赛地点') || e.location,
    getCompField(e, '颁奖单位'),
    getCompField(e, '报名时间'),
    getCompField(e, '比赛时间'),
    getCompField(e, '获奖时间'),
    getCompField(e, '分级依据'),
    String(e.captureIds.length),
    getCompField(e, '备注') || e.description,
  ]);

  const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(escapeCsvCell).join(',')).join('\r\n');
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(`${filenamePrefix}-${stamp}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

export function exportCompetitionMarkdown(experiences: Experience[], title = '个人竞赛经历台账') {
  const sorted = experiences.slice().sort((a, b) => (b.startAt ?? '').localeCompare(a.startAt ?? ''));
  const lines: string[] = [
    `# ${title}`,
    '',
    `> 导出时间：${new Date().toISOString().slice(0, 10)} · 共 ${sorted.length} 条记录`,
    '',
    '| 时间 | 竞赛名称 | 湖大分级 | 奖项 | 成绩/排名 | 颁奖单位 |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const e of sorted) {
    const scoreRank = [getCompField(e, '成绩'), getCompField(e, '排名')].filter(Boolean).join(' / ') || '—';
    const row = [
      e.startAt ?? '待确认',
      e.title.replace(/\|/g, '\\|'),
      getCompField(e, '湖大分级') || '待确认',
      getCompField(e, '奖项') || (isAwarded(e) ? '已获奖' : '—'),
      scoreRank.replace(/\|/g, '\\|'),
      (getCompField(e, '颁奖单位') || '—').replace(/\|/g, '\\|'),
    ];
    lines.push(`| ${row.join(' | ')} |`);
  }
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(`${title}-${stamp}.md`, new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }));
}

function sanitizePathPart(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 48) || '未命名';
}

export async function exportEvidenceZip(experiences: Experience[], captures: Capture[], filenamePrefix = '竞赛佐证材料') {
  const captureMap = new Map(captures.map((c) => [c.id, c]));
  const entries: Record<string, Uint8Array> = {};
  let fileCount = 0;

  for (const e of experiences) {
    const datePart = e.startAt ? e.startAt.slice(0, 7) : '未定时间';
    const awardPart = getCompField(e, '奖项') || getCompField(e, '湖大分级') || '';
    const folder = sanitizePathPart([datePart, e.title, awardPart].filter(Boolean).join('-'));

    // 按佐证槽位分类：证书照片 / 奖牌照片 / 合照 / 相关图片 各一个子文件夹，
    // 未归类的原件进「其他佐证」。交材料时不用再手工分拣。
    const slotBuckets: [string, string[]][] = [];
    for (const slot of EVIDENCE_SLOTS) {
      const ids = e.evidenceSlots?.[slot.key] ?? [];
      if (ids.length) slotBuckets.push([slot.label, ids]);
    }

    const assigned = new Set<string>();
    for (const [, ids] of slotBuckets) for (const id of ids) assigned.add(id);

    const emit = async (cid: string, subFolder: string) => {
      const cap = captureMap.get(cid);
      if (!cap) return;
      const blob = await resolveCaptureBlob(cap);
      if (!blob) return;
      const safeName = sanitizePathPart(cap.originalName || `${cap.title}.bin`);
      let key = `${subFolder}/${safeName}`;
      let n = 2;
      while (entries[key]) {
        key = `${subFolder}/${safeName.replace(/(\.[^.]+)?$/, `-${n}$1`)}`;
        n += 1;
      }
      entries[key] = new Uint8Array(await blob.arrayBuffer());
      fileCount += 1;
    };

    for (const [label, ids] of slotBuckets) {
      for (const cid of ids) await emit(cid, `${folder}/${label}`);
    }
    for (const cid of e.captureIds) {
      if (assigned.has(cid)) continue;
      await emit(cid, `${folder}/其他佐证`);
    }
  }

  if (fileCount === 0) return 0;

  entries['README.txt'] = strToU8(
    `RecallSoro 佐证材料导出包\n导出时间：${new Date().toISOString()}\n包含经历数：${experiences.length}\n包含原件数：${fileCount}\n注意：原件未自动脱敏，外发前请自行检查个人隐私信息。\n`,
  );

  const zipped = zipSync(entries, { level: 1 });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(`${filenamePrefix}-${stamp}.zip`, new Blob([zipped as BlobPart], { type: 'application/zip' }));
  return fileCount;
}
