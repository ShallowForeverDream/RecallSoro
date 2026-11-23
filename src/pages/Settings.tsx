import { useEffect, useRef, useState } from 'react';
import {
  Database,
  Download,
  HardDrive,
  ShieldCheck,
  Smartphone,
  Upload,
} from 'lucide-react';
import { db } from '../db';
import { exportBackup, humanSize, importBackup } from '../lib/utils';
import { Chip, Field, PageHead, useToast } from '../components/common';

export default function Settings() {
  const toast = useToast();
  const [stats, setStats] = useState({ captures: 0, experiences: 0, collections: 0, bytes: 0 });
  const [cloudAi, setCloudAi] = useState('off');
  const [busy, setBusy] = useState(false);
  const mergeRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const loadStats = () =>
    void Promise.all([
      db.captures.toArray(),
      db.experiences.count(),
      db.collections.count(),
      db.settings.get('cloudAi'),
    ]).then(([c, e, col, s]) => {
      setStats({
        captures: c.length,
        experiences: e,
        collections: col,
        bytes: c.reduce((sum, x) => sum + x.sizeBytes, 0),
      });
      setCloudAi(s?.value ?? 'off');
    });

  useEffect(() => {
    loadStats();
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

  return (
    <div className="page">
      <PageHead
        title="设置与备份"
        subtitle="数据全部保存在本机，支持增量合并导入与完整迁移备份"
      />

      <div className="settings-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>本机数据概览</h3>
            <HardDrive size={17} className="muted" />
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
              <strong className="tabular">{stats.collections}</strong>
              <span>台账集合</span>
            </div>
            <div>
              <strong className="tabular">{humanSize(stats.bytes)}</strong>
              <span>原件体积</span>
            </div>
          </div>
          <p className="hint-box">
            卸载应用或更换设备前请先导出完整备份 ZIP。后续版本将支持通过 Tauri 侧把原件直接落盘到可见文件夹。
          </p>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>备份与增量导入</h3>
            <Database size={17} className="muted" />
          </div>
          <p className="muted small" style={{ marginBottom: 14 }}>
            推荐日常使用「增量合并导入」（自动按 ID 与 SHA-256 去重，不会覆盖你已经挂载的证书原图）。
          </p>
          <div className="stack-actions">
            <button className="btn primary wide" disabled={busy} onClick={() => void doExport()}>
              <Download size={15} /> 导出完整备份 ZIP
            </button>
            <button
              className="btn wide"
              disabled={busy}
              onClick={() => mergeRef.current?.click()}
            >
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
          <p className="hint-box">
            导出原件不会自动脱敏，证书照片可能包含身份证号、学号或二维码，外发前请自行核对。
          </p>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>手机轻量传图入口</h3>
            <Chip tone="accent">下一阶段</Chip>
          </div>
          <div className="row-gap" style={{ marginBottom: 10 }}>
            <Smartphone size={18} className="muted" />
            <span className="small">免装手机 App · 局域网扫码直传收件箱</span>
          </div>
          <p className="muted small" style={{ lineHeight: 1.7 }}>
            下一阶段将在桌面端 Rust 侧内置轻量局域网接收服务：点开二维码后，手机微信/浏览器扫码即可把刚拍的证书、奖牌和合照直接传进本机收件箱，并支持监听网盘同步目录兜底。
          </p>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>隐私与识别边界</h3>
            <ShieldCheck size={17} className="muted" />
          </div>
          <Field label="云端 AI 识别" hint="默认关闭，当前仅本地提取哈希、尺寸与日期线索">
            <select
              value={cloudAi}
              onChange={(e) => {
                const v = e.target.value;
                setCloudAi(v);
                void db.settings.put({ key: 'cloudAi', value: v });
              }}
            >
              <option value="off">关闭（本地优先）</option>
              <option value="future">后续版本开放</option>
            </select>
          </Field>
          <p className="muted small" style={{ marginTop: 12 }}>
            <strong>RecallSoro</strong> v0.2 · 个人电子经历总台账
          </p>
        </section>
      </div>
    </div>
  );
}
