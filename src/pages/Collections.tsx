import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, GraduationCap, LayoutGrid, Link2, Map, Plus, Sparkles, Trophy,
} from 'lucide-react';
import { db } from '../db';
import type { Collection, Experience, Capture, Template } from '../types';
import { captureSortKey, now, uid } from '../lib/utils';
import { Chip, Empty, Field, Modal, PageHead, useToast } from '../components/common';

const iconMap: Record<string, typeof Trophy> = { Trophy, Map, Briefcase, GraduationCap, Sparkles };

export function Collections() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [title, setTitle] = useState('');

  const reload = () => void Promise.all([db.templates.toArray(), db.collections.toArray()]).then(([t, c]) => {
    setTemplates(t); setCollections(c);
  });
  useEffect(reload, []);

  const create = async () => {
    if (!templateId) return;
    const id = uid();
    await db.collections.put({
      id, templateId, title: title.trim() || '未命名集合', description: '',
      fieldValues: {}, experienceIds: [], captureIds: [], createdAt: now(), updatedAt: now(),
    });
    setChoosing(false); setTemplateId(''); setTitle('');
    reload();
    navigate(`/collections/${id}`);
  };

  return (
    <div className="page">
      <PageHead title="模板视图" subtitle="竞赛、旅行和自定义模板只是回看方式，资料本身只存一份" actions={
        <button className="btn primary" onClick={() => setChoosing(true)}><Plus size={16} /> 新建集合</button>
      } />

      <h3 className="section-title">可用模板</h3>
      <div className="template-grid">
        {templates.map((t) => {
          const Icon = iconMap[t.icon] ?? LayoutGrid;
          return (
            <div key={t.id} className="template-card">
              <div className="template-icon"><Icon size={22} /></div>
              <div><strong>{t.name}</strong><p>{t.description}</p></div>
              <button className="btn small" onClick={() => { setTemplateId(t.id); setTitle(''); setChoosing(true); }}>使用</button>
            </div>
          );
        })}
      </div>

      <h3 className="section-title">我的集合</h3>
      {collections.length === 0 ? (
        <Empty icon={<LayoutGrid size={34} />} title="还没有集合" desc="选一个模板，创建第一份竞赛或旅行记录。" />
      ) : (
        <div className="card-list">
          {collections.map((c) => {
            const t = templates.find((x) => x.id === c.templateId);
            return (
              <button key={c.id} className="list-card" onClick={() => navigate(`/collections/${c.id}`)}>
                <div className="list-card-icon">{(() => { const I = iconMap[t?.icon ?? ''] ?? LayoutGrid; return <I size={20} />; })()}</div>
                <div className="list-card-main">
                  <div className="list-card-title">{c.title}</div>
                  <p>{c.description || t?.description || '暂无描述'}</p>
                  <div className="row-gap">
                    <Chip tone="accent">{t?.name ?? '自定义'}</Chip>
                    <span className="muted small">{c.experienceIds.length} 段经历 · {c.captureIds.length} 条资料</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {choosing && (
        <Modal title="新建集合" onClose={() => setChoosing(false)}>
          <Field label="选择模板">
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">请选择</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="集合名称"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：2026 杭州旅行" /></Field>
          <div className="modal-actions"><button className="btn primary" disabled={!templateId} onClick={() => void create()}>创建</button></div>
        </Modal>
      )}
    </div>
  );
}

export function CollectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [col, setCol] = useState<Collection | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [pickOpen, setPickOpen] = useState(false);
  const [memberType, setMemberType] = useState<'experience' | 'capture'>('experience');

  useEffect(() => {
    if (!id) return;
    void db.collections.get(id).then((c) => {
      setCol(c ?? null);
      if (c) void db.templates.get(c.templateId).then((t) => setTemplate(t ?? null));
    });
  }, [id]);

  useEffect(() => {
    void Promise.all([db.experiences.toArray(), db.captures.toArray()]).then(([e, c]) => {
      setExperiences(e); setCaptures(c);
    });
  }, []);

  type Member = { key: string; date: string; title: string; desc: string; capture?: Capture };
  const members = useMemo<Member[]>(() => {
    if (!col) return [];
    const ex = experiences.filter((e) => col.experienceIds.includes(e.id)).map((e) => ({
      key: e.id, date: e.startAt ?? '未定时间', title: e.title, desc: e.description,
    }));
    const ca = captures.filter((c) => col.captureIds.includes(c.id)).map((c) => ({
      key: c.id, date: captureSortKey(c), title: c.title, desc: c.note, capture: c,
    }));
    return [...ex, ...ca].sort((a, b) => a.date.localeCompare(b.date));
  }, [col, experiences, captures]);

  if (!col) return <div className="page"><Empty icon={<LayoutGrid size={34} />} title="集合不存在" desc="它可能已被删除。" /></div>;

  const update = async (next: Collection) => {
    setCol(next);
    await db.collections.put({ ...next, updatedAt: now() });
  };

  const toggleMember = async (memberId: string) => {
    if (memberType === 'experience') {
      const ids = col.experienceIds.includes(memberId) ? col.experienceIds.filter((x) => x !== memberId) : [...col.experienceIds, memberId];
      await update({ ...col, experienceIds: ids });
    } else {
      const ids = col.captureIds.includes(memberId) ? col.captureIds.filter((x) => x !== memberId) : [...col.captureIds, memberId];
      await update({ ...col, captureIds: ids });
    }
  };

  return (
    <div className="page">
      <button className="btn ghost back" onClick={() => navigate('/collections')}><ArrowLeft size={16} /> 返回模板视图</button>
      <PageHead title={col.title} subtitle={template?.name ?? '自定义模板'} actions={
        <button className="btn" onClick={() => setPickOpen(true)}><Link2 size={16} /> 管理成员</button>
      } />

      <div className="collection-layout">
        <div className="panel">
          <h3>集合信息</h3>
          <Field label="标题"><input value={col.title} onChange={(e) => void update({ ...col, title: e.target.value })} /></Field>
          <Field label="简介"><textarea rows={3} value={col.description} onChange={(e) => void update({ ...col, description: e.target.value })} /></Field>
          {template?.fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.type === 'textarea'
                ? <textarea rows={3} placeholder={f.placeholder} value={col.fieldValues[f.key] ?? ''} onChange={(e) => void update({ ...col, fieldValues: { ...col.fieldValues, [f.key]: e.target.value } })} />
                : <input placeholder={f.placeholder} value={col.fieldValues[f.key] ?? ''} onChange={(e) => void update({ ...col, fieldValues: { ...col.fieldValues, [f.key]: e.target.value } })} />}
            </Field>
          ))}
        </div>

        <div className="panel">
          <h3>穿插时间线</h3>
          <p className="muted small">经历与图片按时间顺序排列，原始资料不会被复制。</p>
          {members.length === 0 ? <p className="muted">还没有成员，点击“管理成员”添加经历和资料。</p> : (
            <div className="story">
              {members.map((m) => (
                <div key={m.key} className="story-item">
                  <div className="story-date">{m.date}</div>
                  <div className="story-body">
                    <strong>{m.title}</strong>
                    {m.capture?.kind === 'image' && m.capture.blob && <img className="story-image" src={URL.createObjectURL(m.capture.blob)} alt="" />}
                    {m.desc && <p>{m.desc}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {pickOpen && (
        <Modal title="管理集合成员" onClose={() => setPickOpen(false)} wide>
          <div className="filters">
            <button className={`filter-btn ${memberType === 'experience' ? 'active' : ''}`} onClick={() => setMemberType('experience')}>经历</button>
            <button className={`filter-btn ${memberType === 'capture' ? 'active' : ''}`} onClick={() => setMemberType('capture')}>资料</button>
          </div>
          <div className="picker">
            {(memberType === 'experience' ? experiences : captures).map((m) => {
              const checked = memberType === 'experience' ? col.experienceIds.includes(m.id) : col.captureIds.includes(m.id);
              return (
                <button key={m.id} className={`picker-row ${checked ? 'checked' : ''}`} onClick={() => void toggleMember(m.id)}>
                  <span className="picker-check">{checked ? '✓' : ''}</span>
                  <span className="picker-name">{m.title}</span>
                </button>
              );
            })}
          </div>
          <div className="modal-actions"><button className="btn primary" onClick={() => { setPickOpen(false); toast('集合已更新'); }}>完成</button></div>
        </Modal>
      )}
    </div>
  );
}
