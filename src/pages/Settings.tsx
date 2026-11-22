import { useEffect, useState } from 'react';
import { Database, Download, HardDrive, ShieldCheck, Upload } from 'lucide-react';
import { db } from '../db';
import { exportBackup, humanSize, importBackup } from '../lib/utils';
import { Field, PageHead, useToast } from '../components/common';

export default function Settings() {
  const toast = useToast();
  const [stats, setStats] = useState({ captures: 0, experiences: 0, collections: 0, bytes: 0 });
  const [cloudAi, setCloudAi] = useState('off');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([db.captures.toArray(), db.experiences.count(), db.collections.count(), db.settings.get('cloudAi')]).then(([c, e, col, s]) => {
      setStats({ captures: c.length, experiences: e, collections: col, bytes: c.reduce((sum, x) => sum + x.sizeBytes, 0) });
      setCloudAi(s?.value ?? 'off');
    });
  }, []);

  const doExport = async () => {
    setBusy(true);
    try { await exportBackup(); toast('备份已导出'); }
    catch (e) { toast(`导出失败：${String(e)}`); }
    finally { setBusy(false); }
  };

  const doImport = async (file: File) => {
    setBusy(true);
    try { await importBackup(file); toast('备份已恢复，请重启应用'); }
    catch (e) { toast(`恢复失败：${String(e)}`); }
    finally { setBusy(false); }
  };

  return (
    <div className="page">
      <PageHead title="设置与备份" subtitle="数据保存在本机，导出后可完整迁移到另一台设备" />

      <div className="settings-grid">
        <div className="panel">
          <div className="panel-head"><h3>本机数据</h3><HardDrive size={18} /></div>
          <div className="big-stats">
            <div><strong>{stats.captures}</strong><span>条资料</span></div>
            <div><strong>{stats.experiences}</strong><span>段经历</span></div>
            <div><strong>{stats.collections}</strong><span>个集合</span></div>
            <div><strong>{humanSize(stats.bytes)}</strong><span>原件占用</span></div>
          </div>
          <p className="hint-box">数据库和原件都保存在应用本地目录中。卸载应用前请先导出备份。</p>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>备份与迁移</h3><Database size={18} /></div>
          <p className="muted small">导出为 ZIP，包含元数据 JSON 和全部原件。导入会覆盖当前数据，请先确认备份。</p>
          <button className="btn primary wide" disabled={busy} onClick={() => void doExport()}><Download size={16} /> 导出完整备份</button>
          <Field label="从备份恢复">
            <input type="file" accept=".zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); }} />
          </Field>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>隐私与识别</h3><ShieldCheck size={18} /></div>
          <Field label="云端 AI 识别" hint="第一版仅本地提取哈希、时间、文件名和图片尺寸">
            <select value={cloudAi} onChange={(e) => { const v = e.target.value; setCloudAi(v); void db.settings.put({ key: 'cloudAi', value: v }); }}>
              <option value="off">关闭（当前）</option>
              <option value="future">后续版本开放</option>
            </select>
          </Field>
          <p className="hint-box">OCR、图像理解和自动归类将在后续版本加入，且默认关闭。所有建议必须经过你确认才会写入关系。</p>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>关于</h3><Upload size={18} /></div>
          <p><strong>RecallSoro</strong> v0.1.0</p>
          <p className="muted small">个人电子经历总台账 · 桌面版</p>
          <p className="muted small">先收集，后整理，按需回看。</p>
        </div>
      </div>
    </div>
  );
}
