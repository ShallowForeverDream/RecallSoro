import type { Capture, Experience } from '../types';
import { getCompField } from './competition';

/**
 * 纯前端零依赖 JPEG EXIF 拍摄时间提取（读取 APP1 / TIFF IFD0 & ExifIFD 中的 DateTimeOriginal）
 */
export async function extractJpegExifDate(blob: Blob): Promise<string | undefined> {
  if (!blob.type.includes('jpeg') && !blob.type.includes('jpg')) return undefined;
  try {
    const slice = blob.slice(0, 128 * 1024);
    const buf = await slice.arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 12 || view.getUint16(0, false) !== 0xffd8) return undefined;

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xffe1) {
        // APP1
        const len = view.getUint16(offset, false);
        const start = offset + 2;
        if (start + 6 > view.byteLength) return undefined;
        const header = String.fromCharCode(
          view.getUint8(start),
          view.getUint8(start + 1),
          view.getUint8(start + 2),
          view.getUint8(start + 3),
        );
        if (header !== 'Exif') {
          offset += len;
          continue;
        }
        const tiff = start + 6;
        const little = view.getUint16(tiff, false) === 0x4949;
        const firstIfd = view.getUint32(tiff + 4, little);

        const readAscii = (valOffset: number, count: number) => {
          const abs = tiff + valOffset;
          if (abs + count > view.byteLength) return '';
          let s = '';
          for (let i = 0; i < count; i += 1) {
            const ch = view.getUint8(abs + i);
            if (ch === 0) break;
            s += String.fromCharCode(ch);
          }
          return s;
        };

        const parseIfd = (ifdRel: number): { date?: string; exifPtr?: number } => {
          const base = tiff + ifdRel;
          if (base + 2 > view.byteLength) return {};
          const entries = view.getUint16(base, little);
          let date: string | undefined;
          let exifPtr: number | undefined;
          for (let i = 0; i < entries; i += 1) {
            const ent = base + 2 + i * 12;
            if (ent + 12 > view.byteLength) break;
            const tag = view.getUint16(ent, little);
            const count = view.getUint32(ent + 4, little);
            const val = view.getUint32(ent + 8, little);
            if (tag === 0x8769) exifPtr = val;
            if ((tag === 0x9003 || tag === 0x0132) && count >= 10) {
              const raw = readAscii(val, count);
              const m = raw.match(/(\d{4}):(\d{2}):(\d{2})/);
              if (m) date = `${m[1]}-${m[2]}-${m[3]}`;
            }
          }
          return { date, exifPtr };
        };

        const ifd0 = parseIfd(firstIfd);
        if (ifd0.exifPtr) {
          const exif = parseIfd(ifd0.exifPtr);
          if (exif.date) return exif.date;
        }
        if (ifd0.date) return ifd0.date;
        return undefined;
      }
      if ((marker & 0xff00) !== 0xff00) break;
      const segLen = view.getUint16(offset, false);
      if (segLen < 2) break;
      offset += segLen;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export interface MatchSuggestion {
  capture: Capture;
  experience: Experience;
  score: number;
  reasons: string[];
  suggestedSlot: string;
  suggestedDate?: string;
  suggestedAward?: string;
}

function tokenize(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]+/g, ' ')
    .trim();
  const tokens = new Set<string>();
  for (const part of cleaned.split(/\s+/)) {
    if (part.length >= 2) tokens.add(part);
    if (/^[\u4e00-\u9fa5]{4,}$/.test(part)) {
      for (let i = 0; i <= part.length - 2; i += 1) {
        tokens.add(part.slice(i, i + 2));
      }
    }
  }
  return Array.from(tokens);
}

/**
 * OCR 专用的分词：Windows OCR 会把中文逐字输出并用空格分隔
 * （"湖 北 大 学 获 奖 证 书"），直接走 tokenize 几乎提不出有效词。
 * 这里先把单字序列拼回整句，再做二元切分，才能拿到"蓝桥""桥杯"这类可用片段。
 */
function tokenizeOcr(text: string): string[] {
  const tokens = new Set<string>();
  const chars = text.replace(/\s+/g, '');
  // 整句二元切分
  for (let i = 0; i <= chars.length - 2; i += 1) {
    const pair = chars.slice(i, i + 2);
    if (/[\u4e00-\u9fa5]{2}/.test(pair)) tokens.add(pair);
  }
  // 同时保留原文里已经连续成词的片段（如文件名中的赛事名）
  for (const part of text.toLowerCase().split(/[\s,，。；;、]+/)) {
    const clean = part.replace(/[^\u4e00-\u9fa5a-z0-9]/g, '');
    if (clean.length >= 2) {
      tokens.add(clean);
      if (/^[\u4e00-\u9fa5]{4,}$/.test(clean)) {
        for (let i = 0; i <= clean.length - 2; i += 1) tokens.add(clean.slice(i, i + 2));
      }
    }
  }
  return Array.from(tokens);
}

const AWARD_RE = /(特等奖|一等奖|二等奖|三等奖|金奖|银奖|铜奖|优胜奖|优秀奖|国一|国二|国三|省一|省二|省三)/;
/**
 * 区分度低的通用词：几乎每张证书都会出现，命中它们不代表匹配正确。
 * 评分时只给 1 分，真正的赛事名核心词才给高分。
 */
const GENERIC_TOKENS = new Set([
  '湖北', '北大', '大学', '学院', '第十', '第九', '第八', '第七', '第六', '第五',
  '第一', '第二', '第三', '第四', '届', '获奖', '证书', '荣誉', '兹有', '同学',
  '一等', '二等奖', '等第', '等奖', '金奖', '银奖', '铜奖', '优胜', '优秀',
  '参赛', '获奖证书', '决定', '兹', '者', '序号', '专业', '国家', '中国',
]);
const DATE_RE = /(20\d{2})\s*[.\-\/年]\s*(\d{1,2})(?:\s*[.\-\/月]\s*(\d{1,2}))?/;

export function extractDateFromText(text: string): string | undefined {
  const m = text.match(DATE_RE);
  if (!m) return undefined;
  const y = m[1];
  const mo = m[2].padStart(2, '0');
  const d = m[3] ? m[3].padStart(2, '0') : undefined;
  return d ? `${y}-${mo}-${d}` : `${y}-${mo}`;
}

export function extractAwardFromText(text: string): string | undefined {
  // OCR 输出会把「省一等奖」拆成「省 一 等 奖」，先去掉空白再匹配
  const compact = text.replace(/\s+/g, '');
  const m = compact.match(AWARD_RE);
  if (m) return m[1];
  // 「省一」「国三」这类简写，OCR 常识别成「省 一」
  const short = compact.match(/(国|省)([一二三123])/);
  if (short) return `${short[1]}${short[2]}`;
  return undefined;
}

export function guessSlotFromText(text: string): string {
  if (/奖牌|奖杯|medal/i.test(text)) return '奖牌照片';
  if (/合照|合影|团队|集体/i.test(text)) return '合照';
  if (/证书|获奖|荣誉|一等奖|二等奖|三等奖|金奖|银奖|铜奖|公示/i.test(text)) return '证书照片';
  return '相关图片';
}

/**
 * 根据文件名、备注、OCR 全文与 EXIF 时间，为未关联的资料生成可解释的候选归属建议
 */
export function buildMatchSuggestions(
  captures: Capture[],
  experiences: Experience[],
  maxCount = 8,
): MatchSuggestion[] {
  const linkedIds = new Set<string>();
  for (const e of experiences) {
    for (const cid of e.captureIds) linkedIds.add(cid);
  }

  const unlinked = captures.filter((c) => !linkedIds.has(c.id) && (c.kind === 'image' || c.kind === 'file'));
  const suggestions: MatchSuggestion[] = [];

  for (const cap of unlinked) {
    const capText = [
      cap.title,
      cap.originalName,
      cap.note,
      cap.ocrText ?? '',
      ...cap.tags,
      ...cap.facts.map((f) => f.value),
    ].join(' ');

    const capTokens = new Set([
      ...tokenize(cap.title),
      ...tokenize(cap.originalName),
      ...tokenize(cap.note),
      ...tokenizeOcr(cap.ocrText ?? ''),
      ...cap.tags.flatMap((t) => tokenize(t)),
      ...cap.facts.flatMap((f) => tokenize(f.value)),
    ]);
    const capDate = cap.capturedAt ?? extractDateFromText(capText);
    const capYear = capDate?.slice(0, 4);
    const capAward = extractAwardFromText(capText);
    const suggestedSlot = guessSlotFromText(capText);

    let best: MatchSuggestion | null = null;

    for (const exp of experiences) {
      let score = 0;
      const reasons: string[] = [];

      // 标题是主线索；奖项、颁奖单位、队伍等字段作为补充线索一起参与
      const expTokens = new Set([
        ...tokenize(exp.title),
        ...tokenizeOcr(getCompField(exp, '奖项')),
        ...tokenizeOcr(getCompField(exp, '颁奖单位')),
        ...tokenize(exp.tags.join(' ')),
      ]);
      const matchedTokens: string[] = [];
      for (const tok of expTokens) {
        if (
          tok.length >= 2 &&
          capTokens.has(tok) &&
          !/^(全国|中国|大学|大学生|竞赛|比赛|证书|照片|奖|一等奖|二等奖|三等奖)$/.test(tok)
        ) {
          matchedTokens.push(tok);
        }
      }
      if (matchedTokens.length > 0) {
        // 通用词（湖北、第十、一等、获奖等）几乎每张证书都有，命中它们不代表匹配对。
        // 只按数量计分会让「趣味数学竞赛」这类无关条目靠堆通用词拿到满分，
        // 把真正对口的「蓝桥杯」挤到后面。改为按「区分度」计分：
        // 通用词只给 1 分，赛事名核心词给 8 分，并给命中核心词额外加成。
        const generic = matchedTokens.filter((t) => GENERIC_TOKENS.has(t));
        const specific = matchedTokens.filter((t) => !GENERIC_TOKENS.has(t));
        score += Math.min(60, specific.length * 8 + generic.length);
        if (specific.length >= 2) score += 16;
        reasons.push(
          specific.length > 0
            ? `命中赛事关键词：${specific.slice(0, 3).join('、')}`
            : `命中通用线索：${generic.slice(0, 3).join('、')}`,
        );
      }

      if (capYear && exp.startAt?.startsWith(capYear)) {
        score += 18;
        reasons.push(`年份一致（${capYear}）`);
      }

      const expAward = getCompField(exp, '奖项');
      if (capAward && expAward && expAward.includes(capAward)) {
        score += 18;
        reasons.push(`奖项吻合（${capAward}）`);
      }

      // 官方已定级的赛事更可能有正式证书，给一点加权
      const grade = getCompField(exp, '湖大分级');
      if (grade && grade !== '待确认' && grade !== '未列入目录') {
        score += 6;
      }

      // 阈值提高：光靠通用词命中不够，必须有赛事核心词或年份/奖项佐证
      if (score >= 32 && (!best || score > best.score)) {
        best = {
          capture: cap,
          experience: exp,
          score,
          reasons,
          suggestedSlot,
          suggestedDate: !exp.startAt && capDate ? capDate : undefined,
          suggestedAward: !expAward && capAward ? capAward : undefined,
        };
      }
    }

    if (best) suggestions.push(best);
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, maxCount);
}

export interface CredentialExpiryStatus {
  experience: Experience;
  expiryDate: string;
  daysLeft: number;
  state: 'expired' | 'soon' | 'valid';
}

export function auditCredentialExpiries(experiences: Experience[]): CredentialExpiryStatus[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: CredentialExpiryStatus[] = [];

  for (const e of experiences) {
    const raw = (e.customFields?.['有效期至'] ?? '').trim();
    if (!raw || !/^\d{4}-\d{2}-\d{2}/.test(raw)) continue;
    const target = new Date(raw.slice(0, 10));
    if (Number.isNaN(target.getTime())) continue;
    const daysLeft = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const state: CredentialExpiryStatus['state'] =
      daysLeft < 0 ? 'expired' : daysLeft <= 90 ? 'soon' : 'valid';
    out.push({ experience: e, expiryDate: raw.slice(0, 10), daysLeft, state });
  }

  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}
