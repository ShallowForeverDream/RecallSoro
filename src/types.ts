export type CaptureKind = 'image' | 'video' | 'audio' | 'file' | 'text' | 'link';
export type CaptureStatus = 'inbox' | 'processing' | 'ready' | 'archived';
export type TimePrecision = 'exact' | 'day' | 'month' | 'year' | 'range' | 'unknown';

export interface Fact {
  id: string;
  type: 'filename' | 'text' | 'date' | 'tag' | 'dimensions' | 'url' | 'mime';
  value: string;
  confidence: number;
  source: 'local' | 'user';
  createdAt: string;
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
  customFields: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'date' | 'textarea' | 'tags' | 'number';
  placeholder?: string;
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
