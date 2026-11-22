import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FolderOpen, Image, Link2, Plus, UploadCloud, Video, X } from 'lucide-react';
import { db } from '../db';
import type { Capture, CaptureKind } from '../types';
import { captureFromFile, captureFromLink, captureFromText, humanSize, uid, now } from '../lib/utils';
import { Chip, Empty, Field, Modal, PageHead, useToast } from '../components/common';

function CapturePreview({ capture }: { capture: Capture }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!capture.blob) return;
    const u = URL.createObjectURL(capture.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [capture.blob]);

  if (capture.kind === 'image' && url) return <img className="preview-media" src={url} alt={capture.title} />;
  if (capture.kind === 'video' && url) return <video className="preview-media" src={url} controls />;
  if (capture.kind === 'file' && url) {
    return (
      <div className="preview-file">
        <FileText size={40} />
        <p>{capture.originalName}</p>
        <p className="muted">{humanSize(capture.sizeBytes)}</p>
        <a className="btn" href={url} download={capture.originalName}>下载原件</a>
      </div>
    );
  }
  if (capture.kind === 'link') return <div className="preview-text"><Link2 size={20} /><a href={capture.url} target="_blank" rel="noreferrer">{capture.url}</a></div>;
  return <div className="preview-text">{capture.text || capture.note || '无文字内容'}</div>;
}

function Thumb({ capture }: { capture: Capture }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (capture.kind !== 'image' || !capture.blob) return;
    const u = URL.createObjectURL(capture.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [capture.kind, capture.blob]);
  if (url) return <img className="thumb" src={url} alt="" />;
  const Icon = capture.kind === 'video' ? Video : capture.kind === 'text' ? FileText : capture.kind === 'link' ? Link2 : FileText;
  return <div className="thumb thumb-icon"><Icon size={22} /></div>;
}

const kindLabel: Record<CaptureKind, string> = {
  image: '图片', video: '视频', audio: '音频', file: '文件', text: '文字', link: '链接',
};

export default function Inbox() {
  const toast = useToast();
  const navigate = useNavigate();
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | CaptureKind>('all');
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<Capture | null>(null);
  const [draft, setDraft] = useState({ title: '', note: '', capturedAt: '', tags: '' });
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const folderRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    const all = await db.captures.orderBy('importedAt').reverse().toArray();
    setCaptures(all);
  };
  useEffect(() => { void reload(); }, []);

  const addCaptures = async (items: Capture[]) => {
    let added = 0;
    let skipped = 0;
    for (const c of items) {
      if (c.sha256) {
        const dup = await db.captures.where('sha256').equals(c.sha256).first();
        if (dup) { skipped += 1; continue; }
      }
      await db.captures.put(c);
      added += 1;
    }
    await reload();
    if (added) toast(`已收进 ${added} 条资料`);
    if (skipped) toast(`${skipped} 条内容相同，已跳过`);
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const items: Capture[] = [];
    for (const f of list) items.push(await captureFromFile(f, 'web'));
    await addCaptures(items);
  };

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) await handleFiles(e.dataTransfer.files);
  };

  const openDetail = (c: Capture) => {
    setSelected(c);
    setDraft({
      title: c.title,
      note: c.note,
      capturedAt: c.capturedAt ?? '',
      tags: c.tags.join(', '),
    });
  };

  const saveDetail = async () => {
    if (!selected) return;
    const updated: Capture = {
      ...selected,
      title: draft.title,
      note: draft.note,
      capturedAt: draft.capturedAt || undefined,
      tags: draft.tags.split(/[,，\s]+/).filter(Boolean),
    };
    await db.captures.put(updated);
    setSelected(updated);
    await reload();
    toast('已保存');
  };

  const createExperience = async () => {
    if (!selected) return;
    const id = uid();
    await db.experiences.put({
      id,
      title: selected.title,
      description: selected.note,
      startAt: selected.capturedAt,
      endAt: undefined,
      timePrecision: selected.capturedAt?.length === 4 ? 'year' : selected.capturedAt?.length === 7 ? 'month' : selected.capturedAt ? 'day' : 'unknown',
      location: '',
      status: 'draft',
      tags: selected.tags,
      captureIds: [selected.id],
      createdAt: now(),
      updatedAt: now(),
    });
    setSelected(null);
    navigate(`/experiences/${id}`);
  };

  const visible = captures.filter((c) => {
    if (kindFilter !== 'all' && c.kind !== kindFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [c.title, c.originalName, c.note, c.text ?? '', ...c.tags].join(' ').toLowerCase().includes(q);
  });

  return (
    <div className="page">
      <PageHead title="统一收件箱" subtitle="任何资料都可以先放进来，不需要现在决定它属于哪里" />

      <div className="capture-bar">
        <div
          className={`dropzone ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <UploadCloud size={26} />
          <div><strong>拖入图片、文件、视频或 PDF</strong></div>
          <div className="muted">也可以点击这里选择文件 · 相同内容只存一份</div>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => e.target.files && void handleFiles(e.target.files)} />
        </div>
        <div className="quick-column">
          <div className="quick-card">
            <Field label="一句话记录">
              <textarea rows={3} placeholder="例如：2026 年 3 月参加了学校创新创业比赛，遇到了小林" value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <button className="btn primary" disabled={!text.trim()} onClick={async () => { await addCaptures([captureFromText(text)]); setText(''); }}>
              <Plus size={16} /> 收进收件箱
            </button>
          </div>
          <div className="quick-card">
            <Field label="添加链接">
              <input placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
            </Field>
            <button className="btn" disabled={!link.trim()} onClick={async () => { await addCaptures([captureFromLink(link)]); setLink(''); }}>
              <Link2 size={16} /> 收进收件箱
            </button>
          </div>
          <button className="btn wide" onClick={() => folderRef.current?.click()}><FolderOpen size={16} /> 从文件夹批量导入</button>
          <input ref={(el) => {
            if (!el) return;
            folderRef.current = el;
            el.setAttribute('webkitdirectory', '');
          }} type="file" multiple hidden onChange={(e) => e.target.files && void handleFiles(e.target.files)} />
        </div>
      </div>

      <div className="toolbar">
        <input className="search-input" placeholder="搜索标题、文件名、备注、标签…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="filters">
          {(['all', 'image', 'video', 'file', 'text', 'link'] as const).map((k) => (
            <button key={k} className={`filter-btn ${kindFilter === k ? 'active' : ''}`} onClick={() => setKindFilter(k)}>
              {k === 'all' ? '全部' : kindLabel[k]}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty icon={<Image size={34} />} title="收件箱是空的" desc="先把照片、文件或一句话放进来，之后我们再一起整理。" />
      ) : (
        <div className="capture-grid">
          {visible.map((c) => (
            <button key={c.id} className="capture-card" onClick={() => openDetail(c)}>
              <Thumb capture={c} />
              <div className="capture-card-body">
                <div className="capture-title" title={c.title}>{c.title}</div>
                <div className="capture-meta">
                  <Chip>{kindLabel[c.kind]}</Chip>
                  <span>{c.capturedAt ?? c.importedAt.slice(0, 10)}</span>
                </div>
                <div className="muted small">{humanSize(c.sizeBytes)} · {c.source}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <Modal title="资料详情" onClose={() => setSelected(null)} wide>
          <div className="detail-grid">
            <div className="detail-preview"><CapturePreview capture={selected} /></div>
            <div className="detail-form">
              <Field label="标题"><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
              <Field label="发生时间" hint="支持 2026 / 2026-03 / 2026-03-15，不确定就留空">
                <input placeholder="待确认" value={draft.capturedAt} onChange={(e) => setDraft({ ...draft, capturedAt: e.target.value })} />
              </Field>
              <Field label="描述"><textarea rows={4} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
              <Field label="标签" hint="用逗号分隔"><input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} /></Field>
              <div className="fact-block">
                <strong>系统提取的线索</strong>
                {selected.facts.length === 0 ? <p className="muted small">暂无</p> : selected.facts.map((f) => (
                  <div key={f.id} className="fact-row"><span className="fact-type">{f.type}</span><span>{f.value}</span></div>
                ))}
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={() => void saveDetail()}>保存</button>
                <button className="btn primary" onClick={() => void createExperience()}><Plus size={16} /> 创建经历</button>
                <button className="btn ghost" onClick={() => setSelected(null)}><X size={16} /> 关闭</button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
