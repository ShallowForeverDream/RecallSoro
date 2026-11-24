export type CaptureKind = 'image' | 'video' | 'audio' | 'file' | 'text' | 'link';
export type CaptureStatus = 'inbox' | 'processing' | 'ready' | 'archived';
export type TimePrecision = 'exact' | 'day' | 'month' | 'year' | 'range' | 'unknown';

export type FactSource = 'local' | 'user' | 'cloud_ai';

export interface Fact {
  id: string;
  type: 'filename' | 'text' | 'date' | 'tag' | 'dimensions' | 'url' | 'mime' | 'exif' | 'ocr';
  value: string;
  confidence: number;
  source: FactSource;
  /** 云端来源标记，如 cloud_ai:deepseek:deepseek-chat */
  sourceDetail?: string;
  createdAt: string;
}

/**
 * 用户自配的云端 AI 接口（BYOK）。
 * 默认关闭；开启前必须显式配置 endpoint 与 apiKey。
 */
export interface CloudAiConfig {
  enabled: boolean;
  /** 完整 chat 端点，如 https://api.deepseek.com/v1/chat/completions */
  endpoint: string;
  apiKey: string;
  /** HTTP 方法，默认 POST */
  method: 'POST' | 'GET';
  /** 模型名，如 deepseek-chat / glm-4-flash / gpt-4o-mini */
  model: string;
  /** 单次请求超时（毫秒） */
  timeoutMs: number;
  /** 是否允许把 OCR 文本发给云端；默认 false 时只发本地候选结果 */
  allowTextUpload: boolean;
  updatedAt?: string;
}

export const DEFAULT_CLOUD_AI_CONFIG: CloudAiConfig = {
  enabled: false,
  endpoint: '',
  apiKey: '',
  method: 'POST',
  model: '',
  timeoutMs: 20000,
  allowTextUpload: true,
};

/** 单个字段的候选值，带置信度与证据 */
export interface ExtractedField {
  value: string;
  confidence: number;
  /** OCR 原文片段，可回溯 */
  evidence?: string;
  /** 原始值 → 归一化值 */
  normalizedFrom?: string;
}

/**
 * 云端 AI 产出的候选，物理隔离于事实表。
 * AI 没有写 facts/experiences 的路径，只能写这里；用户确认后才落事实。
 */
export interface FactCandidate {
  id: string;
  captureId: string;
  /** 目标经历 id（如已确定归属） */
  experienceId?: string;
  provider: string;
  model: string;
  /** sha256(实际发出的脱敏文本)，去重与审计用 */
  payloadHash: string;
  fields: Record<string, ExtractedField>;
  /** 仅用于排序，不用于自动写入 */
  overallConfidence: number;
  status: 'pending' | 'accepted' | 'rejected' | 'conflict';
  createdAt: string;
  expiresAt?: string;
  rejectedReason?: string;
}

/** 归一化（0~1）无损脱敏遮罩框，绝不破坏原图 */
export interface RedactionBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

export interface Capture {
  id: string;
  kind: CaptureKind;
  blob?: Blob;
  text?: string;
  url?: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  source: string;
  capturedAt?: string;
  importedAt: string;
  status: CaptureStatus;
  title: string;
  note: string;
  tags: string[];
  facts: Fact[];
  /** 本地离线 OCR 识别出的全文 */
  ocrText?: string;
  /** 无损脱敏遮罩坐标列表 */
  redactions?: RedactionBox[];
}

export interface Experience {
  id: string;
  title: string;
  description: string;
  startAt?: string;
  endAt?: string;
  timePrecision: TimePrecision;
  location: string;
  status: 'draft' | 'active' | 'archived';
  tags: string[];
  captureIds: string[];
  /** 可选绑定的模板 ID，例如 tpl-competition */
  templateId?: string;
  /** 结构化台账字段（兼容中英文 key） */
  customFields: Record<string, string>;
  /** 佐证槽位映射，例如 { '证书照片': ['capture-id-1'] } */
  evidenceSlots?: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'date' | 'textarea' | 'tags' | 'number' | 'evidence';
  placeholder?: string;
  group?: string;
}

export interface Template {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  fields: FieldDef[];
  isSystem: boolean;
  createdAt: string;
}

export interface Collection {
  id: string;
  templateId: string;
  title: string;
  description: string;
  coverCaptureId?: string;
  fieldValues: Record<string, string>;
  experienceIds: string[];
  captureIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Relation {
  id: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  relationType: string;
  position: number;
  createdBy: 'user' | 'system';
  createdAt: string;
}

export interface Setting {
  key: string;
  value: string;
}
