import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { Capture, Fact, Template } from '../types';
import { db } from '../db';

export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

export async function sha256Blob(blob: Blob): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function detectKind(file: File): Capture['kind'] {
  const m = file.type;
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m === 'application/pdf' || m.includes('document') || m.includes('sheet') || m.includes('text/')) return 'file';
  return 'file';
}

const DATE_RE = /(20\d{2})\s*[.\-\/年]\s*(\d{1,2})\s*[.\-\/月]?\s*(\d{1,2})?\s*日?/g;

function normalizeDate(raw: string): string | undefined {
  const m = DATE_RE.exec(raw);
  DATE_RE.lastIndex = 0;
  if (!m) return undefined;
  const y = m[1];
  const mo = m[2].padStart(2, '0');
  const d = m[3] ? m[3].padStart(2, '0') : undefined;
  return d ? `${y}-${mo}-${d}` : `${y}-${mo}`;
}

async function imageSize(blob: Blob): Promise<string | undefined> {
  try {
    const bmp = await createImageBitmap(blob);
    const size = `${bmp.width}×${bmp.height}`;
    bmp.close();
    return size;
  } catch {
    return undefined;
  }
}

export function extractFacts(c: Pick<Capture, 'originalName' | 'text' | 'url' | 'mimeType' | 'kind'>): Fact[] {
  const facts: Fact[] = [];
  const push = (type: Fact['type'], value: string, confidence: number, source: Fact['source'] = 'local') => {
    if (value) facts.push({ id: uid(), type, value, confidence, source, createdAt: now() });
  };
  const hay = [c.originalName, c.text ?? '', c.url ?? ''].join(' ');
  push('filename', c.originalName, 1);
  push('mime', c.mimeType, 1);
  const date = normalizeDate(hay);
  if (date) push('date', date, 0.75);
  const tags = hay.match(/#([^\s#，,。]+)/g) ?? [];
  for (const t of tags) push('tag', t.slice(1), 0.9);
  if (c.url) push('url', c.url, 1);
  if (c.text) push('text', c.text.slice(0, 240), 1);
  return facts;
}

export async function captureFromFile(file: File, source: string): Promise<Capture> {
  const sha256 = await sha256Blob(file);
  const kind = detectKind(file);
  const base: Capture = {
    id: uid(),
    kind,
    blob: file,
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    sha256,
    source,
    capturedAt: normalizeDate(file.name),
    importedAt: now(),
    status: 'ready',
    title: file.name.replace(/\.[^.]+$/, ''),
    note: '',
    tags: [],
    facts: [],
  };
  if (kind === 'image') {
    const size = await imageSize(file);
    if (size) base.facts.push({ id: uid(), type: 'dimensions', value: size, confidence: 1, source: 'local', createdAt: now() });
  }
  base.facts.push(...extractFacts(base));
  return base;
}

export function captureFromText(text: string): Capture {
  const base: Capture = {
    id: uid(),
    kind: 'text',
    originalName: '快速记录',
    mimeType: 'text/plain',
    sizeBytes: new Blob([text]).size,
    sha256: '',
    source: 'quick_note',
    capturedAt: normalizeDate(text),
    importedAt: now(),
    status: 'ready',
    title: text.slice(0, 40) || '未命名记录',
    text,
    note: '',
    tags: [],
    facts: [],
  };
  base.facts = extractFacts(base);
  return base;
}

export function captureFromLink(url: string): Capture {
  let name = url;
  try { name = new URL(url).hostname; } catch { /* keep raw */ }
  const base: Capture = {
    id: uid(),
    kind: 'link',
    url,
    originalName: name,
    mimeType: 'text/uri-list',
    sizeBytes: url.length,
    sha256: '',
    source: 'link',
    capturedAt: undefined,
    importedAt: now(),
    status: 'ready',
    title: name,
    note: '',
    tags: [],
    facts: [],
  };
  base.facts = extractFacts(base);
  return base;
}

export function captureSortKey(c: Capture): string {
  return c.capturedAt ?? c.importedAt.slice(0, 10);
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface BackupMeta {
  app: 'RecallSoro';
  version: number;
  exportedAt: string;
  captures: Omit<Capture, 'blob'>[];
  experiences: unknown[];
  templates: Template[];
  collections: unknown[];
  relations: unknown[];
  settings: unknown[];
  files: Record<string, string>;
}

export async function exportBackup() {
  const captures = await db.captures.toArray();
  const files: Record<string, string> = {};
  const meta: BackupMeta = {
    app: 'RecallSoro',
    version: 1,
    exportedAt: now(),
    captures: captures.map(({ blob: _blob, ...rest }) => rest),
    experiences: await db.experiences.toArray(),
    templates: await db.templates.toArray(),
    collections: await db.collections.toArray(),
    relations: await db.relations.toArray(),
    settings: await db.settings.toArray(),
    files,
  };
  const entries: Record<string, Uint8Array> = {
    'backup.json': strToU8(JSON.stringify(meta, null, 2)),
  };
  for (const c of captures) {
    if (c.blob) {
      files[c.id] = `files/${c.id}`;
      entries[`files/${c.id}`] = new Uint8Array(await c.blob.arrayBuffer());
    }
  }
  entries['backup.json'] = strToU8(JSON.stringify(meta, null, 2));
  const zipped = zipSync(entries, { level: 1 });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(`RecallSoro-backup-${stamp}.zip`, new Blob([zipped as BlobPart], { type: 'application/zip' }));
}

export async function importBackup(file: File) {
  const data = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const meta = JSON.parse(strFromU8(data['backup.json'])) as BackupMeta;
  if (meta.app !== 'RecallSoro' || meta.version !== 1) throw new Error('不是有效的 RecallSoro 备份');
  await db.transaction('rw', [db.captures, db.experiences, db.templates, db.collections, db.relations, db.settings], async () => {
    await Promise.all([
      db.captures.clear(),
      db.experiences.clear(),
      db.collections.clear(),
      db.relations.clear(),
      db.settings.clear(),
    ]);
    for (const c of meta.captures) {
      const path = meta.files?.[c.id];
      const blob = path && data[path] ? new Blob([data[path] as BlobPart], { type: c.mimeType }) : undefined;
      await db.captures.put({ ...c, blob });
    }
    await db.experiences.bulkPut(meta.experiences as never[]);
    await db.templates.bulkPut(meta.templates);
    await db.collections.bulkPut(meta.collections as never[]);
    await db.relations.bulkPut(meta.relations as never[]);
    await db.settings.bulkPut(meta.settings as never[]);
  });
}
