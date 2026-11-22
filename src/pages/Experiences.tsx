import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Link2, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { db } from '../db';
import type { Capture, Experience, TimePrecision } from '../types';
import { now, uid } from '../lib/utils';
import { Chip, Empty, Field, Modal, PageHead, useToast } from '../components/common';

const precisionLabel: Record<TimePrecision, string> = {
  exact: '精确到日', day: '某日', month: '某月', year: '某年', range: '时间段', unknown: '待确认',
};

export function Experiences() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Experience[]>([]);
  const reload = () => void db.experiences.orderBy('updatedAt').reverse().toArray().then(setItems);
  useEffect(reload, []);

  const create = async () => {
    const id = uid();
    await db.experiences.put({
      id, title: '未命名经历', description: '', startAt: undefined, endAt: undefined,
      timePrecision: 'unknown', location: '', status: 'draft', tags: [], captureIds: [],
      createdAt: now(), updatedAt: now(),
    });
    navigate(`/experiences/${id}`);
  };

  return (
    <div className="page">
      <PageHead title="经历" subtitle="把零散资料整理成一段真实经历" actions={
        <button className="btn primary" onClick={() => void create()}><Plus size={16} /> 新建经历</button>
      } />
      {items.length === 0 ? (
        <Empty icon={<Sparkles size={34} />} title="还没有经历" desc="从收件箱里选一条资料创建经历，或直接新建。" action={
          <button className="btn primary" onClick={() => void create()}>新建经历</button>
        } />
      ) : (
        <div className="card-list">
          {items.map((e) => (
            <button key={e.id} className="list-card" onClick={() => navigate(`/experiences/${e.id}`)}>
              <div className="list-card-icon"><Sparkles size={20} /></div>
              <div className="list-card-main">
                <div className="list-card-title">{e.title}</div>
                <p>{e.description || '还没有描述'}</p>
                <div className="row-gap">
                  <Chip tone={e.status === 'archived' ? 'neutral' : 'accent'}>{e.status === 'archived' ? '已归档' : '进行中'}</Chip>
                  <span className="muted small">{e.startAt ?? '时间待确认'} · {precisionLabel[e.timePrecision]}</span>
                  <span className="muted small">{e.captureIds.length} 条资料</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExperienceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [exp, setExp] = useState<Experience | null>(null);
  const [attached, setAttached] = useState<Capture[]>([]);
  const [allCaptures, setAllCaptures] = useState<Capture[]>([]);
  const [pickOpen, setPickOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    void db.experiences.get(id).then((e) => setExp(e ?? null));
    void db.captures.toArray().then(setAllCaptures);
  }, [id]);

  useEffect(() => {
    if (!exp) return;
    void db.captures.bulkGet(exp.captureIds).then((rows) => setAttached(rows.filter(Boolean) as Capture[]));
  }, [exp]);

  const save = async () => {
    if (!exp) return;
    await db.experiences.put({ ...exp, updatedAt: now() });
    toast('已保存经历');
  };

  const toggleCapture = async (captureId: string) => {
    if (!exp) return;
    const ids = exp.captureIds.includes(captureId)
      ? exp.captureIds.filter((x) => x !== captureId)
      : [...exp.captureIds, captureId];
    const next = { ...exp, captureIds: ids, updatedAt: now() };
    setExp(next);
    await db.experiences.put(next);
  };

  const sortedAttached = useMemo(() => attached.slice().sort((a, b) => (a.capturedAt ?? a.importedAt).localeCompare(b.capturedAt ?? b.importedAt)), [attached]);

  if (!exp) return <div className="page"><Empty icon={<Sparkles size={34} />} title="经历不存在" desc="它可能已被删除。" /></div>;

  return (
    <div className="page">
      <button className="btn ghost back" onClick={() => navigate('/experiences')}><ArrowLeft size={16} /> 返回经历列表</button>
      <PageHead title={exp.title} subtitle="编辑这段经历的信息，并关联收件箱里的资料" actions={
        <>
          <button className="btn" onClick={() => void save()}><Save size={16} /> 保存</button>
          <button className="btn ghost" onClick={async () => { setExp({ ...exp, status: exp.status === 'archived' ? 'active' : 'archived' }); await db.experiences.put({ ...exp, status: exp.status === 'archived' ? 'active' : 'archived', updatedAt: now() }); }}>{exp.status === 'archived' ? '恢复' : '归档'}</button>
        </>
      } />

      <div className="editor-grid">
        <div className="panel">
          <h3>基本信息</h3>
          <Field label="标题"><input value={exp.title} onChange={(e) => setExp({ ...exp, title: e.target.value })} /></Field>
          <Field label="描述"><textarea rows={5} value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} placeholder="发生了什么，你记住了什么" /></Field>
          <div className="two-col">
            <Field label="开始时间"><input placeholder="2026-03-15" value={exp.startAt ?? ''} onChange={(e) => setExp({ ...exp, startAt: e.target.value || undefined })} /></Field>
            <Field label="结束时间"><input placeholder="可留空" value={exp.endAt ?? ''} onChange={(e) => setExp({ ...exp, endAt: e.target.value || undefined })} /></Field>
          </div>
          <Field label="时间精度">
            <select value={exp.timePrecision} onChange={(e) => setExp({ ...exp, timePrecision: e.target.value as TimePrecision })}>
              {Object.entries(precisionLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="地点"><input value={exp.location} onChange={(e) => setExp({ ...exp, location: e.target.value })} placeholder="城市、场地或机构" /></Field>
          <Field label="标签" hint="用逗号分隔"><input value={exp.tags.join(', ')} onChange={(e) => setExp({ ...exp, tags: e.target.value.split(/[,，\s]+/).filter(Boolean) })} /></Field>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>关联资料 <span className="muted">({attached.length})</span></h3>
            <button className="btn small" onClick={() => setPickOpen(true)}><Link2 size={14} /> 关联资料</button>
          </div>
          {sortedAttached.length === 0 ? (
            <p className="muted">还没有关联资料。可以从收件箱挑选照片、文件或文字。</p>
          ) : (
            <div className="attached-grid">
              {sortedAttached.map((c) => (
                <div key={c.id} className="attached-card">
                  {c.kind === 'image' && c.blob ? <img src={URL.createObjectURL(c.blob)} alt="" /> : <div className="attached-icon"><CalendarDays size={22} /></div>}
                  <div className="attached-title" title={c.title}>{c.title}</div>
                  <button className="attached-remove" title="只解除关联，不删除原资料" onClick={() => void toggleCapture(c.id)}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <p className="hint-box">解除关联只会移除这条关系，原始资料仍保留在收件箱中。</p>
        </div>
      </div>

      {pickOpen && (
        <Modal title="从收件箱关联资料" onClose={() => setPickOpen(false)} wide>
          <div className="picker">
            {allCaptures.length === 0 ? <p className="muted">收件箱还没有资料。</p> : allCaptures.map((c) => {
              const checked = exp.captureIds.includes(c.id);
              return (
                <button key={c.id} className={`picker-row ${checked ? 'checked' : ''}`} onClick={() => void toggleCapture(c.id)}>
                  <span className="picker-check">{checked ? '✓' : ''}</span>
                  <span className="picker-name">{c.title}</span>
                  <span className="muted small">{c.capturedAt ?? c.importedAt.slice(0, 10)}</span>
                </button>
              );
            })}
          </div>
          <div className="modal-actions"><button className="btn primary" onClick={() => setPickOpen(false)}>完成</button></div>
        </Modal>
      )}
    </div>
  );
}
