import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Eye,
  History,
  Image as ImageIcon,
  Link2,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  UploadCloud,
} from 'lucide-react';
import { db } from '../db';
import type { Capture, Experience, Template, TimePrecision } from '../types';
import { now, recordHistory, saveFileCaptureDedup, uid } from '../lib/utils';
import { resolveCaptureBlob } from '../lib/tauriBridge';
import {
  auditCompetition,
  EVIDENCE_SLOTS,
  getCompField,
  gradeTone,
  isAwarded,
  isCompetitionExperience,
  mergeEvidenceText,
  setCompField,
} from '../lib/competition';
import { Chip, Empty, Field, Modal, PageHead, useToast } from '../components/common';
import { HistoryDrawer } from '../components/HistoryDrawer';
import { RedactionEditor } from '../components/RedactionEditor';

const precisionLabel: Record<TimePrecision, string> = {
  exact: '精确到日',
  day: '某日',
  month: '某月',
  year: '某年',
  range: '时间段',
  unknown: '待确认',
};

function CaptureThumbBox({
  capture,
  onPreview,
  onRemove,
}: {
  capture: Capture;
  onPreview: (c: Capture) => void;
  onRemove: () => void;
}) {
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

  return (
    <div className="attached-card">
      <button type="button" className="attached-media-btn" onClick={() => onPreview(capture)}>
        {url ? (
          <img src={url} alt={capture.title} />
        ) : (
          <div className="attached-icon">
            <CalendarDays size={20} />
          </div>
        )}
        <span className="attached-zoom">
          <Eye size={13} />
        </span>
      </button>
      <div className="attached-title" title={capture.title}>
        {capture.title}
      </div>
      <button
        type="button"
        className="attached-remove"
        title="解除关联（不删除收件箱原件）"
        onClick={onRemove}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function LightboxPreview({ capture }: { capture: Capture }) {
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
    return <img className="lightbox-img" src={url} alt={capture.title} />;
  }
  if (url) {
    return (
      <div className="preview-file">
        <p>{capture.originalName}</p>
        <a className="btn primary" href={url} download={capture.originalName}>
          下载原件
        </a>
      </div>
    );
  }
  return <p className="muted">{capture.text || capture.note || '无预览内容'}</p>;
}

export function Experiences() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Experience[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'competition' | 'issues' | 'archived'>('all');

  const reload = () =>
    void db.experiences.orderBy('updatedAt').reverse().toArray().then(setItems);
  useEffect(reload, []);

  const create = async () => {
    const id = uid();
    await db.experiences.put({
      id,
      title: '未命名经历',
      description: '',
      startAt: undefined,
      endAt: undefined,
      timePrecision: 'unknown',
      location: '',
      status: 'active',
      tags: [],
      captureIds: [],
      customFields: {},
      evidenceSlots: {},
      createdAt: now(),
      updatedAt: now(),
    });
    navigate(`/experiences/${id}`);
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((e) => {
      if (filter === 'competition' && !isCompetitionExperience(e)) return false;
      if (filter === 'archived' && e.status !== 'archived') return false;
      if (filter !== 'archived' && e.status === 'archived') return false;
      if (filter === 'issues') {
        const a = auditCompetition(e);
        if (a.issues.length === 0) return false;
      }
      if (!q) return true;
      const hay = [
        e.title,
        e.description,
        e.location,
        e.startAt ?? '',
        ...e.tags,
        ...Object.values(e.customFields ?? {}),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, filter]);

  return (
    <div className="page">
      <PageHead
        title="全部经历"
        subtitle="将零散的照片、证书、文字整理成结构化的真实经历"
        actions={
          <button className="btn primary" onClick={() => void create()}>
            <Plus size={15} /> 新建经历
          </button>
        }
      />

      <div className="toolbar">
        <div className="search-box" style={{ maxWidth: 380 }}>
          <Search size={15} />
          <input
            placeholder="搜索标题、奖项、地点、标签…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="filters">
          {(
            [
              ['all', '进行中'],
              ['competition', '竞赛'],
              ['issues', '待补齐'],
              ['archived', '已归档'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              className={`filter-btn ${filter === k ? 'active' : ''}`}
              onClick={() => setFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty
          icon={<Sparkles size={34} />}
          title="没有找到经历"
          desc="从收件箱挑一条资料创建经历，或直接新建。"
          action={
            <button className="btn primary" onClick={() => void create()}>
              新建经历
            </button>
          }
        />
      ) : (
        <div className="card-list">
          {visible.map((e) => {
            const isComp = isCompetitionExperience(e);
            const grade = isComp ? getCompField(e, '湖大分级') : '';
            const award = isComp ? getCompField(e, '奖项') : '';
            const audit = isComp ? auditCompetition(e) : null;

            return (
              <button
                key={e.id}
                className="list-card"
                onClick={() => navigate(`/experiences/${e.id}`)}
              >
                <div className={`list-card-icon ${isComp ? 'is-gold' : ''}`}>
                  {isComp ? <Trophy size={18} /> : <Sparkles size={18} />}
                </div>
                <div className="list-card-main">
                  <div className="list-card-head">
                    <div className="list-card-title">{e.title}</div>
                    <span className="muted small tabular">{e.startAt ?? '时间待确认'}</span>
                  </div>
                  {(e.description || award) && (
                    <p>{e.description || [award, getCompField(e, '颁奖单位')].filter(Boolean).join(' · ')}</p>
                  )}
                  <div className="row-gap">
                    {grade && <Chip tone={gradeTone(grade)}>{grade}</Chip>}
                    {award && <Chip tone="gold">{award}</Chip>}
                    {e.captureIds.length > 0 ? (
                      <Chip tone="emerald">{e.captureIds.length} 份佐证</Chip>
                    ) : audit?.missingCertificate ? (
                      <Chip tone="danger">缺证书</Chip>
                    ) : null}
                    {e.tags.slice(0, 3).map((t) => (
                      <Chip key={t}>{t}</Chip>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ExperienceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [exp, setExp] = useState<Experience | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [allCaptures, setAllCaptures] = useState<Capture[]>([]);
  const [pickTargetSlot, setPickTargetSlot] = useState<string | null>(null);
  const [previewCap, setPreviewCap] = useState<Capture | null>(null);
  const [redactingCap, setRedactingCap] = useState<Capture | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const slotFileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const backTo = (location.state as { from?: string } | null)?.from ?? '/experiences';

  const reload = async () => {
    if (!id) return;
    const [e, tpls, caps] = await Promise.all([
      db.experiences.get(id),
      db.templates.toArray(),
      db.captures.orderBy('importedAt').reverse().toArray(),
    ]);
    setExp(e ?? null);
    setTemplates(tpls);
    setAllCaptures(caps);
  };

  useEffect(() => {
    void reload();
  }, [id]);

  const captureMap = useMemo(() => new Map(allCaptures.map((c) => [c.id, c])), [allCaptures]);

  const activeTemplate = useMemo(() => {
    if (!exp) return null;
    if (exp.templateId) return templates.find((t) => t.id === exp.templateId) ?? null;
    if (isCompetitionExperience(exp)) {
      return templates.find((t) => t.id === 'tpl-competition') ?? null;
    }
    return null;
  }, [exp, templates]);

  const templateFieldGroups = useMemo(() => {
    if (!activeTemplate) return [];
    const groups = new Map<string, typeof activeTemplate.fields>();
    for (const f of activeTemplate.fields) {
      if (f.type === 'evidence') continue;
      const g = f.group ?? '模板字段';
      const arr = groups.get(g) ?? [];
      arr.push(f);
      groups.set(g, arr);
    }
    return Array.from(groups.entries());
  }, [activeTemplate]);

  const extraCustomKeys = useMemo(() => {
    if (!exp) return [];
    const known = new Set<string>(
      (activeTemplate?.fields ?? []).map((f) => f.key),
    );
    for (const slot of EVIDENCE_SLOTS) known.add(slot.key);
    return Object.keys(exp.customFields ?? {}).filter((k) => !known.has(k));
  }, [exp, activeTemplate]);

  const persist = async (next: Experience, message?: string) => {
    setExp(next);
    if (exp) await recordHistory('experience', next.id, exp);
    await db.experiences.put({ ...next, updatedAt: now() });
    if (message) toast(message);
  };

  const handleSlotUpload = async (slotKey: string, files: FileList | File[]) => {
    if (!exp) return;
    const list = Array.from(files);
    if (list.length === 0) return;

    const addedIds: string[] = [];
    const addedTitles: string[] = [];
    for (const f of list) {
      const { capture } = await saveFileCaptureDedup(f, 'experience_slot');
      addedIds.push(capture.id);
      addedTitles.push(capture.title);
    }

    const prevSlots = exp.evidenceSlots ?? {};
    const nextSlotIds = Array.from(new Set([...(prevSlots[slotKey] ?? []), ...addedIds]));
    const nextCapIds = Array.from(new Set([...exp.captureIds, ...addedIds]));
    const mergedText = mergeEvidenceText(getCompField(exp, slotKey), addedTitles);

    const next: Experience = {
      ...exp,
      captureIds: nextCapIds,
      evidenceSlots: { ...prevSlots, [slotKey]: nextSlotIds },
      customFields: setCompField(exp, slotKey, mergedText),
      updatedAt: now(),
    };
    await persist(next, `已上传并关联到「${slotKey}」`);
    await reload();
  };

  const toggleCaptureInSlot = async (slotKey: string, captureId: string) => {
    if (!exp) return;
    if (slotKey === '__all__') {
      const exists = exp.captureIds.includes(captureId);
      const nextIds = exists
        ? exp.captureIds.filter((x) => x !== captureId)
        : [...exp.captureIds, captureId];
      const nextSlots: Record<string, string[]> = { ...(exp.evidenceSlots ?? {}) };
      if (exists) {
        for (const k of Object.keys(nextSlots)) {
          nextSlots[k] = nextSlots[k].filter((x) => x !== captureId);
        }
      }
      await persist({ ...exp, captureIds: nextIds, evidenceSlots: nextSlots });
      return;
    }

    const prevSlots = exp.evidenceSlots ?? {};
    const cur = prevSlots[slotKey] ?? [];
    const exists = cur.includes(captureId);
    const nextSlotIds = exists ? cur.filter((x) => x !== captureId) : [...cur, captureId];
    const nextCapIds = exists
      ? exp.captureIds
      : Array.from(new Set([...exp.captureIds, captureId]));
    const titles = nextSlotIds
      .map((cid) => captureMap.get(cid)?.title)
      .filter(Boolean)
      .join('，');

    await persist({
      ...exp,
      captureIds: nextCapIds,
      evidenceSlots: { ...prevSlots, [slotKey]: nextSlotIds },
      customFields: setCompField(exp, slotKey, titles),
    });
  };

  if (!exp) {
    return (
      <div className="page">
        <Empty icon={<Sparkles size={34} />} title="经历不存在" desc="它可能已被删除。" />
      </div>
    );
  }

  const isComp = isCompetitionExperience(exp);
  const audit = isComp ? auditCompetition(exp) : null;
  const attachedAll = exp.captureIds
    .map((cid) => captureMap.get(cid))
    .filter(Boolean) as Capture[];

  return (
    <div className="page page-wide">
      <button className="btn ghost back" onClick={() => navigate(backTo)}>
        <ArrowLeft size={15} /> 返回上一页
      </button>

      <PageHead
        title={exp.title}
        subtitle={
          isComp
            ? '补充赛事分级、奖项与证书原件，每次保存自动留存历史快照支持回滚'
            : '编辑这段经历的详细信息，并关联收件箱里的原件资料'
        }
        badge={
          <div className="row-gap">
            {isComp && getCompField(exp, '湖大分级') && (
              <Chip tone={gradeTone(getCompField(exp, '湖大分级'))}>
                {getCompField(exp, '湖大分级')}
              </Chip>
            )}
            {isComp && isAwarded(exp) && getCompField(exp, '奖项') && (
              <Chip tone="gold">{getCompField(exp, '奖项')}</Chip>
            )}
            {audit?.issues.map((issue) => (
              <Chip key={issue} tone="danger">
                {issue}
              </Chip>
            ))}
          </div>
        }
        actions={
          <>
            <button className="btn" onClick={() => setHistoryOpen(true)}>
              <History size={15} /> 历史版本
            </button>
            <button className="btn primary" onClick={() => void persist(exp, '已保存经历')}>
              <Save size={15} /> 保存修改
            </button>
            <button
              className="btn"
              onClick={() =>
                void persist(
                  { ...exp, status: exp.status === 'archived' ? 'active' : 'archived' },
                  exp.status === 'archived' ? '已恢复' : '已归档',
                )
              }
            >
              {exp.status === 'archived' ? '恢复' : '归档'}
            </button>
          </>
        }
      />

      <div className="editor-layout">
        <div className="editor-main">
          <section className="panel">
            <div className="panel-head">
              <h3>基础信息</h3>
              <select
                className="select compact"
                value={exp.templateId ?? (isComp ? 'tpl-competition' : 'tpl-general')}
                onChange={(e) => setExp({ ...exp, templateId: e.target.value })}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    模板：{t.name}
                  </option>
                ))}
              </select>
            </div>

            <Field label="标题">
              <input
                value={exp.title}
                onChange={(e) => setExp({ ...exp, title: e.target.value })}
              />
            </Field>

            <div className="three-col">
              <Field label="开始时间">
                <input
                  placeholder="2026-03-15"
                  value={exp.startAt ?? ''}
                  onChange={(e) => setExp({ ...exp, startAt: e.target.value || undefined })}
                />
              </Field>
              <Field label="结束时间">
                <input
                  placeholder="可留空"
                  value={exp.endAt ?? ''}
                  onChange={(e) => setExp({ ...exp, endAt: e.target.value || undefined })}
                />
              </Field>
              <Field label="时间精度">
                <select
                  value={exp.timePrecision}
                  onChange={(e) =>
                    setExp({ ...exp, timePrecision: e.target.value as TimePrecision })
                  }
                >
                  {Object.entries(precisionLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="two-col">
              <Field label="地点">
                <input
                  value={exp.location}
                  onChange={(e) => setExp({ ...exp, location: e.target.value })}
                  placeholder="城市、场馆或线上"
                />
              </Field>
              <Field label="标签" hint="用逗号分隔，例如：竞赛, 算法">
                <input
                  value={exp.tags.join(', ')}
                  onChange={(e) =>
                    setExp({
                      ...exp,
                      tags: e.target.value.split(/[,，\s]+/).filter(Boolean),
                    })
                  }
                />
              </Field>
            </div>

            <Field label="经历概述">
              <textarea
                rows={3}
                value={exp.description}
                onChange={(e) => setExp({ ...exp, description: e.target.value })}
                placeholder="补充这段经历的背景、过程或关键记忆"
              />
            </Field>
          </section>

          {templateFieldGroups.map(([groupName, fields]) => (
            <section key={groupName} className="panel">
              <h3>{groupName}</h3>
              <div className="form-grid-2">
                {fields.map((f) => {
                  const val = getCompField(exp, f.key);
                  const isWide = f.type === 'textarea';
                  return (
                    <div key={f.key} className={isWide ? 'span-2' : ''}>
                      <Field label={f.label}>
                        {f.type === 'textarea' ? (
                          <textarea
                            rows={3}
                            placeholder={f.placeholder}
                            value={val}
                            onChange={(e) =>
                              setExp({
                                ...exp,
                                customFields: setCompField(exp, f.key, e.target.value),
                              })
                            }
                          />
                        ) : (
                          <input
                            placeholder={f.placeholder}
                            value={val}
                            onChange={(e) =>
                              setExp({
                                ...exp,
                                customFields: setCompField(exp, f.key, e.target.value),
                              })
                            }
                          />
                        )}
                      </Field>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="panel">
            <div className="panel-head">
              <h3>其他扩展字段</h3>
              <button
                className="btn small"
                onClick={() => {
                  const key = `扩展字段${extraCustomKeys.length + 1}`;
                  setExp({
                    ...exp,
                    customFields: { ...(exp.customFields ?? {}), [key]: '' },
                  });
                }}
              >
                <Plus size={14} /> 添加字段
              </button>
            </div>
            {extraCustomKeys.length === 0 ? (
              <p className="muted small">没有额外自定义字段，需要时可点击右上角添加。</p>
            ) : (
              extraCustomKeys.map((key) => {
                const value = exp.customFields[key] ?? '';
                return (
                  <div key={key} className="custom-row">
                    <input
                      value={key}
                      onChange={(e) => {
                        const next: Record<string, string> = {};
                        for (const [k, v] of Object.entries(exp.customFields)) {
                          next[k === key ? e.target.value : k] = v;
                        }
                        setExp({ ...exp, customFields: next });
                      }}
                      placeholder="字段名"
                    />
                    <input
                      value={value}
                      onChange={(e) =>
                        setExp({
                          ...exp,
                          customFields: { ...exp.customFields, [key]: e.target.value },
                        })
                      }
                      placeholder="内容"
                    />
                    <button
                      className="icon-btn"
                      title="删除字段"
                      onClick={() => {
                        const next = { ...exp.customFields };
                        delete next[key];
                        setExp({ ...exp, customFields: next });
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </section>
        </div>

        <aside className="editor-side">
          {isComp && (
            <section className="panel">
              <div className="panel-head">
                <h3>佐证材料槽位</h3>
                <span className="muted small">拖图即自动归档并去重</span>
              </div>
              <div className="slot-list">
                {EVIDENCE_SLOTS.map((slot) => {
                  const slotIds = exp.evidenceSlots?.[slot.key] ?? [];
                  const slotCaps = slotIds
                    .map((cid) => captureMap.get(cid))
                    .filter(Boolean) as Capture[];
                  const legacyText = getCompField(exp, slot.key);

                  return (
                    <div
                      key={slot.key}
                      className="evidence-slot"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files.length) {
                          void handleSlotUpload(slot.key, e.dataTransfer.files);
                        }
                      }}
                    >
                      <div className="evidence-slot-head">
                        <div>
                          <strong>{slot.label}</strong>
                          <span className="muted small" style={{ marginLeft: 6 }}>
                            {slotCaps.length} 份
                          </span>
                        </div>
                        <div className="row-gap">
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => slotFileRefs.current[slot.key]?.click()}
                          >
                            <UploadCloud size={13} /> 上传
                          </button>
                          <button
                            type="button"
                            className="btn small ghost"
                            onClick={() => setPickTargetSlot(slot.key)}
                          >
                            <Link2 size={13} /> 选图
                          </button>
                          <input
                            ref={(el) => {
                              slotFileRefs.current[slot.key] = el;
                            }}
                            type="file"
                            multiple
                            accept="image/*,.pdf"
                            hidden
                            onChange={(e) => {
                              if (e.target.files?.length) {
                                void handleSlotUpload(slot.key, e.target.files);
                              }
                              e.target.value = '';
                            }}
                          />
                        </div>
                      </div>

                      {slotCaps.length > 0 ? (
                        <div className="attached-grid compact-grid">
                          {slotCaps.map((c) => (
                            <CaptureThumbBox
                              key={c.id}
                              capture={c}
                              onPreview={setPreviewCap}
                              onRemove={() => void toggleCaptureInSlot(slot.key, c.id)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="slot-empty">
                          <ImageIcon size={15} />
                          <span>
                            {legacyText
                              ? `已有文字线索：${legacyText}（可拖入原图）`
                              : `拖入${slot.label}，或点击右上角上传`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-head">
              <h3>
                全部关联资料 <span className="muted">({attachedAll.length})</span>
              </h3>
              <button className="btn small" onClick={() => setPickTargetSlot('__all__')}>
                <Link2 size={13} /> 关联资料
              </button>
            </div>
            {attachedAll.length === 0 ? (
              <p className="muted small">还没有关联任何资料。解除关联不会删除收件箱原件。</p>
            ) : (
              <div className="attached-grid">
                {attachedAll.map((c) => (
                  <CaptureThumbBox
                    key={c.id}
                    capture={c}
                    onPreview={setPreviewCap}
                    onRemove={() => void toggleCaptureInSlot('__all__', c.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {pickTargetSlot && (
        <Modal
          title={
            pickTargetSlot === '__all__'
              ? '从收件箱关联资料'
              : `选择资料关联到「${pickTargetSlot}」`
          }
          onClose={() => setPickTargetSlot(null)}
          wide
        >
          <div className="picker">
            {allCaptures.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>
                收件箱里还没有资料，你可以直接拖拽图片到右侧槽位上传。
              </p>
            ) : (
              allCaptures.map((c) => {
                const checked =
                  pickTargetSlot === '__all__'
                    ? exp.captureIds.includes(c.id)
                    : (exp.evidenceSlots?.[pickTargetSlot] ?? []).includes(c.id);
                return (
                  <button
                    key={c.id}
                    className={`picker-row ${checked ? 'checked' : ''}`}
                    onClick={() => void toggleCaptureInSlot(pickTargetSlot, c.id)}
                  >
                    <span className="picker-check">{checked ? '✓' : ''}</span>
                    <span className="picker-name">{c.title}</span>
                    <span className="muted small tabular">
                      {c.capturedAt ?? c.importedAt.slice(0, 10)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="modal-actions">
            <button className="btn primary" onClick={() => setPickTargetSlot(null)}>
              完成
            </button>
          </div>
        </Modal>
      )}

      {previewCap && (
        <Modal title={previewCap.title} onClose={() => setPreviewCap(null)} wide>
          <div className="lightbox-wrap">
            <LightboxPreview capture={previewCap} />
          </div>
          {previewCap.kind === 'image' && (
            <div className="modal-actions">
              <button
                className="btn"
                onClick={() => {
                  const target = previewCap;
                  setPreviewCap(null);
                  setRedactingCap(target);
                }}
              >
                <ShieldCheck size={14} /> 无损隐私脱敏
                {previewCap.redactions?.length ? ` (${previewCap.redactions.length})` : ''}
              </button>
            </div>
          )}
        </Modal>
      )}

      {redactingCap && (
        <RedactionEditor
          capture={redactingCap}
          onClose={() => setRedactingCap(null)}
          onSaved={() => void reload()}
        />
      )}

      {historyOpen && (
        <HistoryDrawer
          entityId={exp.id}
          onClose={() => setHistoryOpen(false)}
          onRestore={async (snap) => {
            await persist({ ...exp, ...snap, id: exp.id });
          }}
        />
      )}
    </div>
  );
}
