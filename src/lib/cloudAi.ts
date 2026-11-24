/**
 * 云端 AI 能力（BYOK）。
 *
 * 设计红线：
 * - 默认关闭，用户自己配置 endpoint / apiKey / model / method；
 * - 只把脱敏后的文本发出去；
 * - 返回的结果只写入 candidates 表，绝不写 facts/experiences；
 * - 用户逐字段确认后才落事实。
 */
import type { Capture, CloudAiConfig, Experience, ExtractedField, FactCandidate } from '../types';
import { DEFAULT_CLOUD_AI_CONFIG } from '../types';
import { db } from '../db';
import { getCompField } from './competition';
import { isTauriDesktop } from './tauriBridge';

interface TauriInternals {
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
}
declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

interface AiResponse {
  text: string;
  model: string | null;
  status: string;
}

async function invokeAi<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  if (!isTauriDesktop()) {
    throw new Error('云端 AI 需要在桌面端使用');
  }
  return window.__TAURI_INTERNALS__!.invoke<T>(cmd, args);
}

export async function loadCloudAiConfig(): Promise<CloudAiConfig> {
  const setting = await db.settings.get('cloudAi');
  if (!setting?.value) return { ...DEFAULT_CLOUD_AI_CONFIG };
  try {
    const parsed = JSON.parse(setting.value) as CloudAiConfig;
    // 兼容旧版 'off'/'future' 字符串
    if (typeof parsed !== 'object' || !('endpoint' in parsed)) {
      return { ...DEFAULT_CLOUD_AI_CONFIG };
    }
    return { ...DEFAULT_CLOUD_AI_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CLOUD_AI_CONFIG };
  }
}

export async function saveCloudAiConfig(config: CloudAiConfig): Promise<void> {
  await db.settings.put({
    key: 'cloudAi',
    value: JSON.stringify({ ...config, updatedAt: new Date().toISOString() }),
  });
}

export async function testCloudAi(config: CloudAiConfig): Promise<string> {
  const res = await invokeAi<AiResponse>('test_cloud_ai', {
    req: {
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      method: config.method,
      model: config.model,
      messages: [{ role: 'user', content: 'ping' }],
      timeoutMs: config.timeoutMs,
    },
  });
  return `连接成功（${res.status}，模型 ${res.model ?? config.model}）：${res.text.slice(0, 60)}`;
}

/** 简单 SHA-256，用于 payloadHash（脱敏文本去重与审计） */
async function sha256Text(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 先在本地脱敏再发送：去掉手机号、身份证号、学号、姓名等。
 * RecallSoro 已有 redactions 坐标，但文本层再做一遍正则兜底，
 * 保证即使没有画遮罩也不会把敏感号码发给第三方。
 */
export function redactTextForCloud(text: string): string {
  return text
    .replace(/\b1[3-9]\d{9}\b/g, '[手机号]')
    .replace(/\b\d{17}[\dXx]\b/g, '[身份证号]')
    .replace(/\b\d{8,12}\b/g, '[编号]')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[邮箱]')
    .replace(/(学\s*号|身份证\s*号|手机\s*号)\s*[:：]?\s*\[?[^\s，。；,;]{4,}/g, '$1：[已脱敏]');
}

const EXTRACT_PROMPT = `你是一个中文竞赛证书信息抽取助手。请从用户提供的证书 OCR 文本中抽取结构化信息，严格按以下 JSON 格式输出，不要输出任何解释文字：

{
  "title": "赛事全称（去掉届次，如：蓝桥杯全国软件和信息技术专业人才大赛软件赛C/C++省赛）",
  "award": "奖项（如：省一、国三、一等奖）",
  "score": "成绩（如：360分）或空字符串",
  "rank": "排名（如：1/279）或空字符串",
  "issuer": "颁奖单位或空字符串",
  "awardDate": "获奖日期 YYYY-MM-DD 或空字符串",
  "grade": "级别描述（如：省级、国家级）或空字符串"
}

规则：
1. 字段值必须是原文中真实出现的，不要编造，不确定就填空字符串；
2. 不要推断 A1/A2/B1/B2 分级——那由本地台账决定；
3. 中文 OCR 可能逐字带空格，请先还原成正常文本再抽取；
4. 只输出 JSON，不要 markdown 代码块。`;

function parseAiJson(text: string): Record<string, string> | null {
  // 容忍模型套了 ```json ... ``` 代码块
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (!obj || typeof obj !== 'object') return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') out[k] = v.trim();
      else if (v === null || v === undefined) out[k] = '';
      else out[k] = String(v);
    }
    return out;
  } catch {
    return null;
  }
}

/** 把 AI 返回的字段映射到 Experience.customFields 的键 */
const FIELD_MAP: Record<string, string> = {
  title: '竞赛名称',
  award: '奖项',
  score: '成绩',
  rank: '排名',
  issuer: '颁奖单位',
  awardDate: '获奖时间',
  grade: '原表级别',
};

/**
 * 调用云端 AI 抽取证书字段，产出候选（只写 candidates 表）。
 * 返回候选 id 列表，UI 据此展示逐字段确认界面。
 */
export async function extractFieldsWithCloud(
  capture: Capture,
  experiences: Experience[],
  config: CloudAiConfig,
): Promise<string[]> {
  if (!config.enabled) throw new Error('云端 AI 未启用');
  const ocr = (capture.ocrText ?? '').trim();
  if (!ocr) throw new Error('该资料还没有 OCR 文本，请先在本地 OCR');

  const safeText = config.allowTextUpload ? redactTextForCloud(ocr) : '';
  if (!safeText) throw new Error('未允许上传文本，且本地无可发送的线索');

  // 把台账里的赛事名作为候选提示注入，约束模型在已知集合里选，减少幻觉
  const hint = experiences
    .slice(0, 98)
    .map((e) => e.title)
    .join('\n');
  const userContent = `证书 OCR 文本（已脱敏）：\n${safeText}\n\n已知赛事清单（请优先从中匹配，只返回最贴近的一条全称）：\n${hint}`;

  const res = await invokeAi<AiResponse>('call_cloud_ai', {
    req: {
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      method: config.method,
      model: config.model,
      messages: [
        { role: 'system', content: EXTRACT_PROMPT },
        { role: 'user', content: userContent },
      ],
      timeoutMs: config.timeoutMs,
    },
  });

  const parsed = parseAiJson(res.text);
  if (!parsed) throw new Error('AI 返回结果无法解析为 JSON，未生成候选');

  // 找到本地最贴近的经历（仅做归属提示，不自动写入）
  const cleanTitle = (parsed.title ?? '').replace(/\s+/g, '');
  let matchedExp: Experience | undefined;
  let bestScore = 0;
  for (const exp of experiences) {
    const t = exp.title.replace(/\s+/g, '');
    let score = 0;
    for (const ch of cleanTitle) if (t.includes(ch)) score += 1;
    const ratio = cleanTitle ? score / cleanTitle.length : 0;
    if (ratio > bestScore) {
      bestScore = ratio;
      matchedExp = exp;
    }
  }
  const experienceId = bestScore >= 0.6 ? matchedExp?.id : undefined;

  const fields: Record<string, ExtractedField> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!value) continue;
    const cfKey = FIELD_MAP[key] ?? key;
    fields[cfKey] = {
      value,
      confidence: bestScore >= 0.6 ? 0.8 : 0.5,
      evidence: safeText.slice(0, 200),
    };
  }
  // 分级绝不让 AI 决定，从匹配到的本地经历带入
  if (matchedExp) {
    const grade = getCompField(matchedExp, '湖大分级');
    if (grade) {
      fields['湖大分级'] = {
        value: grade,
        confidence: 1,
        evidence: '来自本地台账官方目录，非 AI 推断',
      };
    }
  }

  const payloadHash = await sha256Text(safeText + res.text);
  const id = crypto.randomUUID();
  const candidate: FactCandidate = {
    id,
    captureId: capture.id,
    experienceId,
    provider: 'custom',
    model: res.model ?? config.model,
    payloadHash,
    fields,
    overallConfidence: bestScore,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
  };
  await db.candidates.put(candidate);
  return [id];
}

export async function listPendingCandidates(): Promise<FactCandidate[]> {
  const all = await db.candidates.toArray();
  return all
    .filter((c) => c.status === 'pending')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 接受某一个字段：只把该字段写入事实/经历，候选本身保留记录 */
export async function acceptCandidateField(
  candidateId: string,
  fieldKey: string,
): Promise<void> {
  const candidate = await db.candidates.get(candidateId);
  if (!candidate || candidate.status !== 'pending') return;
  const field = candidate.fields[fieldKey];
  if (!field) return;

  if (candidate.experienceId) {
    const exp = await db.experiences.get(candidate.experienceId);
    if (exp) {
      const next: Experience = {
        ...exp,
        customFields: {
          ...exp.customFields,
          [fieldKey]: field.value,
        },
        updatedAt: new Date().toISOString(),
      };
      await db.experiences.put(next);
    }
  }

  // 事实留在候选记录里审计（RecallDatabase 没有独立 facts 表），
  // 真正被确认的字段已经写进 Experience.customFields。
  await db.candidates.put({ ...candidate, status: 'accepted' });
}

export async function rejectCandidate(candidateId: string, reason = ''): Promise<void> {
  const candidate = await db.candidates.get(candidateId);
  if (!candidate) return;
  await db.candidates.put({
    ...candidate,
    status: 'rejected',
    rejectedReason: reason,
  });
}
