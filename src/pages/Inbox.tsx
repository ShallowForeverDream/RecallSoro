import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Link2,
  Plus,
  Search,
  Smartphone,
  UploadCloud,
  Video,
  X,
} from 'lucide-react';
import { db } from '../db';
import type { Capture, CaptureKind } from '../types';
import {
  captureFromLink,
  captureFromText,
  humanSize,
  now,
  recordHistory,
  saveFileCaptureDedup,
  uid,
} from '../lib/utils';
import { resolveCaptureBlob } from '../lib/tauriBridge';
import { Chip, Empty, Field, Modal, PageHead, useToast } from '../components/common';
import { LanDropModal } from '../components/LanDropModal';

function CapturePreview({ capture }: { capture: Capture }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    let objUrl = '';
    void resolveCaptureBlob(capture).then((blob) => {
      if (!active || !blob) return;
      objUrl = URL.createObjectURL(blob);
      setUrl(objUrl);
    });
    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [capture]);

  if (capture.kind === 'image' && url) {
    return <img className="preview-media" src={url} alt={capture.title} />;
  }
  if (capture.kind === 'video' && url) {
    return <video className="preview-media" src={url} controls />;
  }
  if (capture.kind === 'file' && url) {
    return (
      <div className="preview-file">
        <FileText size={38} />
        <p>{capture.originalName}</p>
        <p className="muted">{humanSize(capture.sizeBytes)}</p>
        <a className="btn primary" href={url} download={capture.originalName}>
          下载原件
        </a>
      </div>
    );
  }
  if (capture.kind === 'link') {
    return (
      <div className="preview-text">
        <Link2 size={18} />
        <a href={capture.url} target="_blank" rel="noreferrer">
          {capture.url}
        </a>
      </div>
    );
  }
  return <div className="preview-text">{capture.text || capture.note || '无文字内容'}</div>;
}

function Thumb({ capture }: { capture: Capture }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (capture.kind !== 'image') return;
    let active = true;
    let objUrl = '';
    void resolveCaptureBlob(capture).then((blob) => {
      if (!active || !blob) return;
      objUrl = URL.createObjectURL(blob);
      setUrl(objUrl);
    });
    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [capture]);

  if (url) return <img className="thumb" src={url} alt="" />;
  const Icon =
    capture.kind === 'video'
      ? Video
      : capture.kind === 'link'
        ? Link2
        : FileText;
  return (
    <div className="thumb thumb-icon">
      <Icon size={22} />
    </div>
  );
}

const kindLabel: Record<CaptureKind, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  file: '文件',
  text: '文字',
  link: '链接',
};

export default function Inbox() {
  const toast = useToast();
  const navigate = useNavigate();
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | CaptureKind>('all');
  const [captureTab, setCaptureTab] = useState<'file' | 'text' | 'link'>('file');
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<Capture | null>(null);
  const [draft, setDraft] = useState({ title: '', note: '', capturedAt: '', tags: '' });
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [lanOpen, setLanOpen] = useState(false);
  const folderRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    const all = await db.captures.orderBy('importedAt').reverse().toArray();
    setCaptures(all);
  };
  useEffect(() => {
    void reload();
  }, []);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    let added = 0;
    let skipped = 0;
    for (const f of list) {
      const { deduplicated } = await saveFileCaptureDedup(f, 'web');
      if (deduplicated) skipped += 1;
      else added += 1;
    }
    await reload();
    if (added && skipped) toast(`已收进 ${added} 条资料，跳过 ${skipped} 条重复原件`);
    else if (added) toast(`已收进 ${added} 条资料`);
    else if (skipped) toast(`${skipped} 条内容相同，已自动去重`);
  };

  const addSimpleCapture = async (c: Capture) => {
    await db.captures.put(c);
    await reload();
    toast('已收进收件箱');
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
    await recordHistory('capture', selected.id, selected);
    await db.captures.put(updated);
    setSelected(updated);
    await reload();
    toast('已保存资料信息');
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
      timePrecision:
        selected.capturedAt?.length === 4
          ? 'year'
          : selected.capturedAt?.length === 7
            ? 'month'
            : selected.capturedAt
              ? 'day'
              : 'unknown',
      location: '',
      status: 'active',
      tags: selected.tags,
      captureIds: [selected.id],
      customFields: {},
      evidenceSlots: {},
      createdAt: now(),
      updatedAt: now(),
    });
    setSelected(null);
    navigate(`/experiences/${id}`, { state: { from: '/' } });
  };

  const visible = captures.filter((c) => {
    if (kindFilter !== 'all' && c.kind !== kindFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [c.title, c.originalName, c.note, c.text ?? '', ...c.tags]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  return (
    <div className="page">
      <PageHead
        title="统一收件箱"
        subtitle="证书、合照、截图、PDF、一句话备忘都先扔进来，SHA-256 自动去重，稍后再关联到台账"
        actions={
          <>
            <button className="btn primary" onClick={() => setLanOpen(true)}>
              <Smartphone size={15} /> 手机扫码传图
            </button>
            <button className="btn" onClick={() => folderRef.current?.click()}>
              <FolderOpen size={15} /> 批量导入文件夹
            </button>
          </>
        }
      />

      <input
        ref={(el) => {
          if (!el) return;
          folderRef.current = el;
          el.setAttribute('webkitdirectory', '');
        }}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="capture-dock">
        <div className="capture-dock-tabs">
          <button
            className={`dock-tab ${captureTab === 'file' ? 'active' : ''}`}
            onClick={() => setCaptureTab('file')}
          >
            <UploadCloud size={15} /> 拖入文件 / 照片
          </button>
          <button
            className={`dock-tab ${captureTab === 'text' ? 'active' : ''}`}
            onClick={() => setCaptureTab('text')}
          >
            <Plus size={15} /> 一句话记录
          </button>
          <button
            className={`dock-tab ${captureTab === 'link' ? 'active' : ''}`}
            onClick={() => setCaptureTab('link')}
          >
            <Link2 size={15} /> 收藏链接
          </button>
        </div>

        {captureTab === 'file' && (
          <div
            className={`dropzone compact-dropzone ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <UploadCloud size={24} />
            <strong>拖拽图片、证书 PDF、视频到这里，或点击选择文件</strong>
            <span className="muted small">桌面端自动落盘到本地目录并按 SHA-256 去重</span>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) void handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {captureTab === 'text' && (
          <div className="dock-inline-form">
            <textarea
              rows={2}
              placeholder="例如：2026 年 5 月获得蓝桥杯省赛一等奖，证书已发到邮箱 #竞赛"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              className="btn primary"
              disabled={!text.trim()}
              onClick={async () => {
                await addSimpleCapture(captureFromText(text));
                setText('');
              }}
            >
              <Plus size={15} /> 收进收件箱
            </button>
          </div>
        )}

        {captureTab === 'link' && (
          <div className="dock-inline-form row">
            <input
              placeholder="粘贴公示名单、作品仓库或报道链接（https://...）"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            <button
              className="btn primary"
              disabled={!link.trim()}
              onClick={async () => {
                await addSimpleCapture(captureFromLink(link));
                setLink('');
              }}
            >
              <Link2 size={15} /> 收进收件箱
            </button>
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="search-box" style={{ maxWidth: 380 }}>
          <Search size={15} />
          <input
            placeholder="搜索标题、文件名、备注、标签…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="filters">
          {(['all', 'image', 'file', 'video', 'text', 'link'] as const).map((k) => (
            <button
              key={k}
              className={`filter-btn ${kindFilter === k ? 'active' : ''}`}
              onClick={() => setKindFilter(k)}
            >
              {k === 'all' ? `全部 (${captures.length})` : kindLabel[k]}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty
          icon={<ImageIcon size={34} />}
          title="收件箱里暂时没有资料"
          desc="你可以直接拖入文件，或点右上角「手机扫码传图」把相册里的证书和合照传进来。"
          action={
            <button className="btn primary" onClick={() => setLanOpen(true)}>
              <Smartphone size={15} /> 手机扫码传图
            </button>
          }
        />
      ) : (
        <div className="capture-grid">
          {visible.map((c) => (
            <button key={c.id} className="capture-card" onClick={() => openDetail(c)}>
              <Thumb capture={c} />
              <div className="capture-card-body">
                <div className="capture-title" title={c.title}>
                  {c.title}
                </div>
                <div className="capture-meta">
                  <Chip>{kindLabel[c.kind]}</Chip>
                  <span className="tabular">{c.capturedAt ?? c.importedAt.slice(0, 10)}</span>
                </div>
                <div className="muted small">
                  {humanSize(c.sizeBytes)} · {c.source === 'mobile_lan' ? '手机快传' : c.source}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <Modal title="资料详情" subtitle={selected.originalName} onClose={() => setSelected(null)} wide>
          <div className="detail-grid">
            <div className="detail-preview">
              <CapturePreview capture={selected} />
            </div>
            <div className="detail-form">
              <Field label="标题">
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </Field>
              <Field label="发生时间" hint="支持 2026 / 2026-03 / 2026-03-15，不确定可留空">
                <input
                  placeholder="待确认"
                  value={draft.capturedAt}
                  onChange={(e) => setDraft({ ...draft, capturedAt: e.target.value })}
                />
              </Field>
              <Field label="备注说明">
                <textarea
                  rows={3}
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </Field>
              <Field label="标签" hint="用逗号分隔">
                <input
                  value={draft.tags}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                />
              </Field>
              <div className="fact-block">
                <strong>本地提取线索</strong>
                {selected.facts.length === 0 ? (
                  <p className="muted small">暂无</p>
                ) : (
                  selected.facts.map((f) => (
                    <div key={f.id} className="fact-row">
                      <span className="fact-type">{f.type}</span>
                      <span>{f.value}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={() => void saveDetail()}>
                  保存
                </button>
                <button className="btn primary" onClick={() => void createExperience()}>
                  <Plus size={15} /> 转为新经历
                </button>
                <button className="btn ghost" onClick={() => setSelected(null)}>
                  <X size={15} /> 关闭
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {lanOpen && <LanDropModal onClose={() => setLanOpen(false)} onReceived={() => void reload()} />}
    </div>
  );
}
