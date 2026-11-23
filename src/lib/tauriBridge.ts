import type { Capture } from '../types';
import { db } from '../db';

interface TauriInternals {
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

export interface StorageInfo {
  dataDir: string;
  blobsDir: string;
  blobCount: number;
  totalBytes: number;
  hasSnapshot: boolean;
  snapshotBytes: number;
}

export interface StoredBlobResult {
  sha256: string;
  sizeBytes: number;
  deduplicated: boolean;
  relativePath: string;
}

export interface IngestedFile {
  sha256: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  modifiedMs: number;
  deduplicated: boolean;
}

export interface LanDropStatus {
  running: boolean;
  url: string;
  ip: string;
  port: number;
  token: string;
  receivedCount: number;
}

export interface LanDropItem {
  sha256: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  slot: string;
  note: string;
  deduplicated: boolean;
  receivedAtMs: number;
}

export function isTauriDesktop(): boolean {
  return typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__?.invoke === 'function';
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriDesktop()) {
    throw new Error('当前为浏览器预览模式，请在桌面端应用（pnpm tauri dev）中使用此能力');
  }
  return window.__TAURI_INTERNALS__!.invoke<T>(cmd, args);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export async function saveBlobToLocalDisk(blob: Blob): Promise<StoredBlobResult | null> {
  if (!isTauriDesktop()) return null;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const dataBase64 = bytesToBase64(bytes);
  return tauriInvoke<StoredBlobResult>('save_blob_base64', { dataBase64 });
}

export async function readBlobFromLocalDisk(sha256: string, mimeType: string): Promise<Blob | null> {
  if (!isTauriDesktop() || !sha256) return null;
  try {
    const b64 = await tauriInvoke<string>('read_blob_base64', { sha256 });
    const bytes = base64ToBytes(b64);
    return new Blob([bytes as BlobPart], { type: mimeType || 'application/octet-stream' });
  } catch {
    return null;
  }
}

export async function resolveCaptureBlob(capture: Capture): Promise<Blob | null> {
  if (capture.blob) return capture.blob;
  if (capture.sha256) {
    return readBlobFromLocalDisk(capture.sha256, capture.mimeType);
  }
  return null;
}

export async function writeLedgerSnapshotToDisk(): Promise<LedgerSnapshotInfo> {
  const captures = await db.captures.toArray();
  const payload = {
    app: 'RecallSoro',
    version: 1,
    savedAt: new Date().toISOString(),
    captures: captures.map(({ blob: _b, ...rest }) => rest),
    experiences: await db.experiences.toArray(),
    templates: await db.templates.toArray(),
    collections: await db.collections.toArray(),
    relations: await db.relations.toArray(),
    settings: await db.settings.toArray(),
  };
  return writeLedgerSnapshot(JSON.stringify(payload, null, 2));
}

export async function readLedgerSnapshotFromDisk(): Promise<string> {
  return tauriInvoke<string>('read_ledger_snapshot');
}

export interface OcrWord {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OcrLine {
  text: string;
  words: OcrWord[];
}

export interface SensitiveRegion {
  kind: 'id_card' | 'mobile' | 'student_id' | 'bank_card' | string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
}

export interface OcrResult {
  text: string;
  lines: OcrLine[];
  width: number;
  height: number;
  sensitive: SensitiveRegion[];
  engine: string;
}

export interface LedgerSnapshotInfo {
  path: string;
  bytes: number;
  updatedAt: string;
  versionCount: number;
}

export interface LedgerVersion {
  version: number;
  savedAt: string;
  bytes: number;
  path: string;
}

export async function runLocalOcr(sha256: string, lang?: string): Promise<OcrResult> {
  return tauriInvoke<OcrResult>('ocr_blob_windows', { sha256, lang: lang ?? null });
}

export async function writeLedgerSnapshot(jsonText: string): Promise<LedgerSnapshotInfo> {
  return tauriInvoke<LedgerSnapshotInfo>('write_ledger_snapshot', { jsonText });
}

export async function listLedgerVersions(): Promise<LedgerVersion[]> {
  return tauriInvoke<LedgerVersion[]>('list_ledger_versions');
}

export async function restoreLedgerVersion(versionPath: string): Promise<LedgerSnapshotInfo> {
  return tauriInvoke<LedgerSnapshotInfo>('restore_ledger_version', { versionPath });
}

export async function readCjkFontBase64(): Promise<string> {
  return tauriInvoke<string>('read_cjk_font_base64');
}

export async function getLedgerDirInfo(): Promise<string> {
  return tauriInvoke<string>('get_ledger_dir_info');
}

export async function getStorageInfo(): Promise<StorageInfo | null> {
  if (!isTauriDesktop()) return null;
  return tauriInvoke<StorageInfo>('get_storage_info');
}

export async function openDataDir(): Promise<void> {
  await tauriInvoke<void>('open_data_dir');
}

export async function scanWatchFolder(folderPath: string, knownSha256s: string[]): Promise<IngestedFile[]> {
  return tauriInvoke<IngestedFile[]>('scan_watch_folder', { folderPath, knownSha256s });
}

export async function startLanDrop(): Promise<LanDropStatus> {
  return tauriInvoke<LanDropStatus>('start_lan_drop');
}

export async function stopLanDrop(): Promise<void> {
  await tauriInvoke<void>('stop_lan_drop');
}

export async function getLanDropStatus(): Promise<LanDropStatus> {
  return tauriInvoke<LanDropStatus>('get_lan_drop_status');
}

export async function pollLanDropInbox(): Promise<LanDropItem[]> {
  return tauriInvoke<LanDropItem[]>('poll_lan_drop_inbox');
}

export async function migrateIndexedDbBlobsToDisk(): Promise<{ migrated: number; freedBytes: number }> {
  if (!isTauriDesktop()) {
    throw new Error('仅在 Tauri 桌面端支持本地落盘迁移');
  }
  const all = await db.captures.toArray();
  let migrated = 0;
  let freedBytes = 0;
  for (const c of all) {
    if (!c.blob) continue;
    const saved = await saveBlobToLocalDisk(c.blob);
    if (saved) {
      freedBytes += c.blob.size;
      await db.captures.put({ ...c, sha256: saved.sha256, blob: undefined });
      migrated += 1;
    }
  }
  await writeLedgerSnapshotToDisk().catch(() => undefined);
  return { migrated, freedBytes };
}
