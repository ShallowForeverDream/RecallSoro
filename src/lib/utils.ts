import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { Capture, Collection, Experience, Fact, Relation, Setting, Template } from '../types';
import { db, SYSTEM_TEMPLATES, type HistoryRecord } from '../db';
import { isTauriDesktop, resolveCaptureBlob, saveBlobToLocalDisk } from './tauriBridge';

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

export async function recordHistory(
  entityType: HistoryRecord['entityType'],
  entityId: string,
  snapshot: unknown,
) {
  await db.history.put({
    id: uid(),
    entityType,
    entityId,
    snapshot: JSON.parse(JSON.stringify(snapshot)) as unknown,
    createdAt: now(),
  });
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
    capturedAt: undefined,
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
  for (const f of base.facts) if (f.type === 'date') f.confidence = 0.5;
  return base;
}

/** 将文件入库并按 SHA-256 去重；桌面端自动落盘到本地 blobs 目录 */
export async function saveFileCaptureDedup(file: File, source: string): Promise<{ capture: Capture; deduplicated: boolean }> {
  const draft = await captureFromFile(file, source);
  if (draft.sha256) {
    const existing = await db.captures.where('sha256').equals(draft.sha256).first();
    if (existing) return { capture: existing, deduplicated: true };
  }
  if (isTauriDesktop() && draft.blob) {
    const stored = await saveBlobToLocalDisk(draft.blob);
    if (stored) {
      draft.sha256 = stored.sha256;
      draft.blob = undefined;
    }
  }
  await db.captures.put(draft);
  return { capture: draft, deduplicated: false };
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
  experiences: Experience[];
  templates: Template[];
  collections: Collection[];
  relations: Relation[];
  settings: Setting[];
  files: Record<string, string>;
}

export interface ImportSummary {
  capturesAdded: number;
  experiencesAdded: number;
  experiencesMerged: number;
  collectionsMerged: number;
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
    const resolved = await resolveCaptureBlob(c);
    if (resolved) {
      files[c.id] = `files/${c.id}`;
      entries[`files/${c.id}`] = new Uint8Array(await resolved.arrayBuffer());
    }
  }
  entries['backup.json'] = strToU8(JSON.stringify(meta, null, 2));
  const zipped = zipSync(entries, { level: 1 });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(`RecallSoro-backup-${stamp}.zip`, new Blob([zipped as BlobPart], { type: 'application/zip' }));
}

export async function importBackup(file: File, mode: 'merge' | 'replace' = 'merge'): Promise<ImportSummary> {
  const data = unzipSync(new Uint8Array(await file.arrayBuffer()));
  if (!data['backup.json']) throw new Error('压缩包中缺少 backup.json');
  const meta = JSON.parse(strFromU8(data['backup.json'])) as BackupMeta;
  if (meta.app !== 'RecallSoro' || meta.version !== 1) throw new Error('不是有效的 RecallSoro 备份');

  const summary: ImportSummary = {
    capturesAdded: 0,
    experiencesAdded: 0,
    experiencesMerged: 0,
    collectionsMerged: 0,
  };

  const desktop = isTauriDesktop();

  if (mode === 'replace') {
    const preparedCaptures: Capture[] = [];
    for (const c of meta.captures) {
      const path = meta.files?.[c.id];
      let blob = path && data[path] ? new Blob([data[path] as BlobPart], { type: c.mimeType }) : undefined;
      let sha256 = c.sha256;
      if (desktop && blob) {
        const stored = await saveBlobToLocalDisk(blob);
        if (stored) {
          sha256 = stored.sha256;
          blob = undefined;
        }
      }
      preparedCaptures.push({ ...c, sha256, blob });
    }

    await db.transaction('rw', [db.captures, db.experiences, db.templates, db.collections, db.relations, db.settings], async () => {
      await Promise.all([
        db.captures.clear(),
        db.experiences.clear(),
        db.collections.clear(),
        db.relations.clear(),
        db.settings.clear(),
      ]);
      await db.captures.bulkPut(preparedCaptures);
      summary.capturesAdded = preparedCaptures.length;
      await db.experiences.bulkPut(meta.experiences);
      summary.experiencesAdded = meta.experiences.length;
      const mergedTemplates = SYSTEM_TEMPLATES.slice();
      for (const t of meta.templates) {
        if (!mergedTemplates.some((x) => x.id === t.id)) mergedTemplates.push(t);
      }
      await db.templates.bulkPut(mergedTemplates);
      await db.collections.bulkPut(meta.collections);
      summary.collectionsMerged = meta.collections.length;
      await db.relations.bulkPut(meta.relations);
      await db.settings.bulkPut(meta.settings);
    });
    return summary;
  }

  // 增量合并模式：先准备落盘，再进事务写入
  const existingCaptures = await db.captures.toArray();
  const shaMap = new Map(existingCaptures.filter((c) => c.sha256).map((c) => [c.sha256, c.id]));
  const existingCapIds = new Set(existingCaptures.map((c) => c.id));
  const capIdRemap = new Map<string, string>();
  const newCapturesToInsert: Capture[] = [];

  for (const c of meta.captures) {
    if (c.sha256 && shaMap.has(c.sha256)) {
      capIdRemap.set(c.id, shaMap.get(c.sha256)!);
      continue;
    }
    if (existingCapIds.has(c.id)) {
      capIdRemap.set(c.id, c.id);
      continue;
    }
    const path = meta.files?.[c.id];
    let blob = path && data[path] ? new Blob([data[path] as BlobPart], { type: c.mimeType }) : undefined;
    let sha256 = c.sha256;
    if (desktop && blob) {
      const stored = await saveBlobToLocalDisk(blob);
      if (stored) {
        sha256 = stored.sha256;
        blob = undefined;
      }
    }
    newCapturesToInsert.push({ ...c, sha256, blob });
    capIdRemap.set(c.id, c.id);
    if (sha256) shaMap.set(sha256, c.id);
  }

  await db.transaction('rw', [db.captures, db.experiences, db.templates, db.collections, db.relations], async () => {
    if (newCapturesToInsert.length) {
      await db.captures.bulkPut(newCapturesToInsert);
      summary.capturesAdded = newCapturesToInsert.length;
    }

    for (const t of meta.templates) {
      if (!t.isSystem && !(await db.templates.get(t.id))) {
        await db.templates.put(t);
      }
    }

    for (const incoming of meta.experiences) {
      const remappedCaps = incoming.captureIds.map((cid) => capIdRemap.get(cid) ?? cid);
      const existing = await db.experiences.get(incoming.id);
      if (!existing) {
        await db.experiences.put({ ...incoming, captureIds: Array.from(new Set(remappedCaps)) });
        summary.experiencesAdded += 1;
      } else {
        const mergedCustom = { ...(incoming.customFields ?? {}), ...(existing.customFields ?? {}) };
        const mergedTags = Array.from(new Set([...(existing.tags ?? []), ...(incoming.tags ?? [])]));
        const mergedCaps = Array.from(new Set([...(existing.captureIds ?? []), ...remappedCaps]));
        await db.experiences.put({
          ...existing,
          customFields: mergedCustom,
          tags: mergedTags,
          captureIds: mergedCaps,
          updatedAt: now(),
        });
        summary.experiencesMerged += 1;
      }
    }

    for (const incoming of meta.collections) {
      const remappedCaps = incoming.captureIds.map((cid) => capIdRemap.get(cid) ?? cid);
      const existing = await db.collections.get(incoming.id);
      if (!existing) {
        await db.collections.put({ ...incoming, captureIds: Array.from(new Set(remappedCaps)) });
      } else {
        await db.collections.put({
          ...existing,
          experienceIds: Array.from(new Set([...existing.experienceIds, ...incoming.experienceIds])),
          captureIds: Array.from(new Set([...existing.captureIds, ...remappedCaps])),
          updatedAt: now(),
        });
      }
      summary.collectionsMerged += 1;
    }

    for (const r of meta.relations) {
      if (!(await db.relations.get(r.id))) await db.relations.put(r);
    }
  });

  return summary;
}
