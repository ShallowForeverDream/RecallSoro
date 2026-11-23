import { useEffect, useRef, useState } from 'react';
import {
  Database,
  Download,
  FolderOpen,
  HardDrive,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Upload,
} from 'lucide-react';
import { db } from '../db';
import type { Capture } from '../types';
import {
  exportBackup,
  extractFacts,
  humanSize,
  importBackup,
  importSnapshotJson,
  now,
  uid,
} from '../lib/utils';
import {
  getStorageInfo,
  isTauriDesktop,
  listLedgerVersions,
  migrateIndexedDbBlobsToDisk,
  openDataDir,
  readLedgerSnapshotFromDisk,
  restoreLedgerVersion,
  scanWatchFolder,
  writeLedgerSnapshotToDisk,
  type LedgerVersion,
  type StorageInfo,
} from '../lib/tauriBridge';
import { Chip, Field, PageHead, useToast } from '../components/common';
import { LanDropModal } from '../components/LanDropModal';

export default function Settings() {
  const toast = useToast();
  const [stats, setStats] = useState({ captures: 0, experiences: 0, collections: 0, bytes: 0, idbBlobs: 0 });
  const [diskInfo, setDiskInfo] = useState<StorageInfo | null>(null);
  const [cloudAi, setCloudAi] = useState('off');
  const [watchFolder, setWatchFolder] = useState('');
  const [busy, setBusy] = useState(false);
  const [lanOpen, setLanOpen] = useState(false);
  const [versions, setVersions] = useState<LedgerVersion[]>([]);
  const mergeRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const loadStats = () =>
    void Promise.all([
      db.captures.toArray(),
      db.experiences.count(),
      db.collections.count(),
      db.settings.get('cloudAi'),
      db.settings.get('watchFolder'),
      getStorageInfo().catch(() => null),
    ]).then(([c, e, col, s, wf, disk]) => {
      setStats({
        captures: c.length,
        experiences: e,
        collections: col,
        bytes: c.reduce((sum, x) => sum + x.sizeBytes, 0),
        idbBlobs: c.filter((x) => Boolean(x.blob)).length,
      });
      setCloudAi(s?.value ?? 'off');
      setWatchFolder(wf?.value ?? '');
      setDiskInfo(disk);
    });

  useEffect(() => {
    loadStats();
    void loadVersions();
  }, []);

  const doExport = async () => {
    setBusy(true);
    try {
      await exportBackup();
      toast('完整备份 ZIP 已导出');
    } catch (e) {
      toast(`导出失败：${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file: File, mode: 'merge' | 'replace') => {
    setBusy(true);
    try {
      const res = await importBackup(file, mode);
      loadStats();
      if (mode === 'merge') {
        toast(
          `增量合并完成：新增 ${res.experiencesAdded} 条经历、合并 ${res.experiencesMerged} 条，新增 ${res.capturesAdded} 份资料`,
        );
      } else {
        toast(`已覆盖恢复 ${res.experiencesAdded} 条经历与 ${res.capturesAdded} 份资料`);
      }
    } catch (e) {
      toast(`导入失败：${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const doMigrateToDisk = async () => {
    setBusy(true);
    try {
      const res = await migrateIndexedDbBlobsToDisk();
      loadStats();
      toast(`已将 ${res.migrated} 份原件落盘到本地目录，释放 ${humanSize(res.freedBytes)} 浏览器缓存`);
    } catch (e) {
      toast(`迁移失败：${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const doSaveSnapshot = async () => {
    setBusy(true);
    try {
      const info = await writeLedgerSnapshotToDisk();
      loadStats();
      toast(`元数据已落盘（${humanSize(info.bytes)}），历史版本 ${info.versionCount} 份`);
    } catch (e) {
      toast(`写入快照失败：${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const doRestoreSnapshot = async () => {
    setBusy(true);
    try {
      const json = await readLedgerSnapshotFromDisk();
      const res = await importSnapshotJson(json);
      loadStats();
      toast(`已从本地快照合并 ${res.experiencesAdded + res.experiencesMerged} 条经历`);
    } catch (e) {
      toast(`恢复失败：${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  /** 列出账本历史版本 */
  const loadVersions = async () => {
    try {
      setVersions(await listLedgerVersions());
    } catch {
      setVersions([]);
    }
  };

  /** 回滚到指定历史版本 */
  const doRollback = async (versionPath: string, savedAt: string) => {
    setBusy(true);
    try {
      await restoreLedgerVersion(versionPath);
      const json = await readLedgerSnapshotFromDisk();
      const res = await importSnapshotJson(json);
      await loadVersions();
      toast(
        `已回滚到 ${savedAt.slice(0, 19).replace('T', ' ')} 的版本，合并 ${res.experiencesAdded + res.experiencesMerged} 条经历`,
      );
    } catch (e) {
      toast(`回滚失败：${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const doScanWatchFolder = async () => {
    if (!watchFolder.trim()) {
      toast('请先填写本机同步文件夹路径');
      return;
    }
    setBusy(true);
    try {
      await db.settings.put({ key: 'watchFolder', value: watchFolder.trim() });
      const existing = await db.captures.toArray();
      const known = existing.map((c) => c.sha256).filter(Boolean);
      const ingested = await scanWatchFolder(watchFolder.trim(), known);
      let added = 0;
      for (const item of ingested) {
        const kind: Capture['kind'] = item.mimeType.startsWith('image/')
          ? 'image'
          : item.mimeType.startsWith('video/')
            ? 'video'
            : 'file';
        const cap: Capture = {
          id: uid(),
          kind,
          originalName: item.originalName,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          sha256: item.sha256,
          source: 'watch_folder',
          capturedAt: item.modifiedMs ? new Date(item.modifiedMs).toISOString().slice(0, 10) : undefined,
          importedAt: now(),
          status: 'ready',
          title: item.originalName.replace(/\.[^.]+$/, ''),
          note: '',
          tags: ['同步目录'],
          facts: [],
        };
        cap.facts = extractFacts(cap);
        await db.captures.put(cap);
        added += 1;
      }
      loadStats();
      toast(added > 0 ? `从同步目录吸入 ${added} 份新原件` : '同步目录中没有新的未收录文件');
    } catch (e) {
      toast(`扫描失败：${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const desktop = isTauriDesktop();

  return (
    <div className="page">
      <PageHead
        title="设置与备份"
        subtitle="原件与元数据同目录落盘（配合 Syncthing/网盘即可跨设备同步）、手机扫码快传与增量迁移"
      />

      <div className="settings-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>本机原件与元数据快照</h3>
            <Chip tone={desktop ? 'emerald' : 'neutral'}>
              {desktop ? '桌面端本地目录' : '浏览器预览模式'}
            </Chip>
          </div>
          <div className="big-stats">
            <div>
              <strong className="tabular">{stats.captures}</strong>
              <span>原件资料</span>
            </div>
            <div>
              <strong className="tabular">{stats.experiences}</strong>
              <span>结构经历</span>
            </div>
            <div>
              <strong className="tabular">{diskInfo ? diskInfo.blobCount : stats.idbBlobs}</strong>
              <span>{diskInfo ? '已落盘原件' : '缓存原件'}</span>
            </div>
            <div>
              <strong className="tabular">
                {humanSize(diskInfo ? diskInfo.totalBytes : stats.bytes)}
              </strong>
              <span>原件占用</span>
            </div>
          </div>

          {diskInfo && (
            <p className="hint-box" style={{ wordBreak: 'break-all' }}>
              数据目录：<code>{diskInfo.dataDir}</code>
              <br />
              元数据账本：
              {diskInfo.hasSnapshot
                ? `ledger.json (${humanSize(diskInfo.snapshotBytes)}) · 每次修改自动落盘，保留最近 30 个版本`
                : '尚未生成，点击下方立即写入'}
            </p>
          )}

          {desktop && versions.length > 0 && (
            <div className="version-list">
              <div className="row-gap" style={{ margin: '16px 0 8px' }}>
                <strong className="small">账本历史版本（{versions.length}）</strong>
                <span className="small muted">可回滚到任一版本，回滚前会自动保留当前状态</span>
              </div>
              {versions.slice(0, 8).map((v) => (
                <div key={v.path} className="version-row">
                  <span className="small tabular">{v.savedAt.slice(0, 19).replace('T', ' ')}</span>
                  <span className="small muted">{humanSize(v.bytes)}</span>
                  <button
                    className="btn small ghost"
                    disabled={busy}
                    onClick={() => void doRollback(v.path, v.savedAt)}
                  >
                    <RotateCcw size={12} /> 回滚到此版本
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="row-gap" style={{ marginTop: 14 }}>
            <button
              className="btn"
              disabled={!desktop || busy}
              onClick={() => void openDataDir().catch((e) => toast(String(e)))}
            >
              <FolderOpen size={15} /> 打开数据目录
            </button>
            <button
              className="btn"
              disabled={!desktop || busy}
              onClick={() => void doSaveSnapshot()}
            >
              <Save size={15} /> 立即落盘快照
            </button>
            {desktop && diskInfo?.hasSnapshot && (
              <button className="btn ghost" disabled={busy} onClick={() => void doRestoreSnapshot()}>
                <RotateCcw size={14} /> 从快照恢复
              </button>
            )}
            {desktop && stats.idbBlobs > 0 && (
              <button className="btn primary" disabled={busy} onClick={() => void doMigrateToDisk()}>
                <HardDrive size={15} /> 迁移 {stats.idbBlobs} 份缓存原件到磁盘
              </button>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>备份与增量导入</h3>
            <Database size={17} className="muted" />
          </div>
          <p className="muted small" style={{ marginBottom: 14 }}>
            推荐日常使用「增量合并导入」（按 ID 与 SHA-256 自动去重，保留你已挂好的证书原图）。
          </p>
          <div className="stack-actions">
            <button className="btn primary wide" disabled={busy} onClick={() => void doExport()}>
              <Download size={15} /> 导出完整备份 ZIP
            </button>
            <button className="btn wide" disabled={busy} onClick={() => mergeRef.current?.click()}>
              <Upload size={15} /> 增量合并导入 ZIP（推荐）
            </button>
            <button
              className="btn ghost wide"
              disabled={busy}
              onClick={() => replaceRef.current?.click()}
            >
              覆盖恢复备份 ZIP（清空当前库）
            </button>
          </div>
          <input
            ref={mergeRef}
            type="file"
            accept=".zip"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f, 'merge');
              e.target.value = '';
            }}
          />
          <input
            ref={replaceRef}
            type="file"
            accept=".zip"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f, 'replace');
              e.target.value = '';
            }}
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>手机传图与同步目录</h3>
            <Chip tone="accent">轻量采集</Chip>
          </div>
          <p className="muted small" style={{ marginBottom: 12 }}>
            同 Wi-Fi 下直接扫码传图；出门在外可把手机照片存进网盘/Syncthing 同步目录，回电脑一键吸入。
          </p>
          <button className="btn primary wide" onClick={() => setLanOpen(true)}>
            <Smartphone size={15} /> 打开局域网手机扫码传图
          </button>

          <div style={{ marginTop: 16 }}>
            <Field
              label="收件箱同步目录（可选）"
              hint="例如：D:\\OneDrive\\RecallSoro-Inbox"
            >
              <input
                value={watchFolder}
                placeholder="输入本机同步文件夹完整路径"
                onChange={(e) => setWatchFolder(e.target.value)}
              />
            </Field>
            <button
              className="btn wide"
              disabled={!desktop || busy}
              onClick={() => void doScanWatchFolder()}
            >
              <RefreshCw size={14} /> 立即扫描同步目录并吸入新原件
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>隐私与识别边界</h3>
            <ShieldCheck size={17} className="muted" />
          </div>
          <Field label="云端 AI 识别" hint="默认关闭；桌面端已内置 Windows 离线 OCR 与 EXIF 解析">
            <select
              value={cloudAi}
              onChange={(e) => {
                const v = e.target.value;
                setCloudAi(v);
                void db.settings.put({ key: 'cloudAi', value: v });
              }}
            >
              <option value="off">关闭（本地离线优先）</option>
              <option value="future">后续版本开放</option>
            </select>
          </Field>
          <p className="hint-box">
            所有证书支持无损隐私脱敏遮罩；导出 PDF 证明册时可勾选自动应用脱敏，原件永远保持完整。
          </p>
          <p className="muted small" style={{ marginTop: 12 }}>
            <strong>RecallSoro</strong> v0.4 · 个人电子经历总台账
          </p>
        </section>
      </div>

      {lanOpen && <LanDropModal onClose={() => setLanOpen(false)} onReceived={loadStats} />}
    </div>
  );
}
