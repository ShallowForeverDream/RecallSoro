export type CaptureKind = 'image' | 'video' | 'audio' | 'file' | 'text' | 'link';
export type CaptureStatus = 'inbox' | 'processing' | 'ready' | 'archived';
export type TimePrecision = 'exact' | 'day' | 'month' | 'year' | 'range' | 'unknown';

export interface Fact {
  id: string;
  type: 'filename' | 'text' | 'date' | 'tag' | 'dimensions' | 'url' | 'mime' | 'exif' | 'ocr';
  value: string;
  confidence: number;
  source: 'local' | 'user';
  createdAt: string;
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
