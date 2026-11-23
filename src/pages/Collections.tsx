import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Briefcase,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  GraduationCap,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Map as MapIcon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Table2,
  Trophy,
  Upload,
  UploadCloud,
} from 'lucide-react';
import { db } from '../db';
import type { Capture, Collection, Experience, Template } from '../types';
import {
  captureSortKey,
  importBackup,
  now,
  recordHistory,
  saveFileCaptureDedup,
  uid,
} from '../lib/utils';
import {
  auditCompetition,
  EVIDENCE_SLOTS,
  exportCompetitionCSV,
  exportCompetitionMarkdown,
  exportEvidenceZip,
  getCompField,
  getExperienceGroup,
  getGradeBucket,
  gradeTone,
  isAwarded,
} from '../lib/competition';
import { Chip, Empty, Field, Modal, PageHead, StatCard, useToast } from '../components/common';

const iconMap: Record<string, typeof Trophy> = {
  Trophy,
  Map: MapIcon,
  Briefcase,
  GraduationCap,
  Sparkles,
  BookOpen,
};

function CaptureThumb({ capture }: { capture: Capture }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (capture.kind !== 'image' || !capture.blob) return;
    const u = URL.createObjectURL(capture.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [capture.kind, capture.blob]);

  if (url) return <img className="story-image" src={url} alt={capture.title} />;
  return null;
}

export function Collections() {
  const navigate = useNavigate();
  const toast = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [title, setTitle] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const reload = () =>
    void Promise.all([
      db.templates.toArray(),
      db.collections.toArray(),
      db.experiences.toArray(),
    ]).then(([t, c, e]) => {
      setTemplates(t);
      setCollections(c);
      setExperiences(e);
    });
  useEffect(reload, []);

  const expMap = useMemo(() => new Map(experiences.map((e) => [e.id, e])), [experiences]);

  const create = async () => {
    if (!templateId) return;
    const id = uid();
    await db.collections.put({
      id,
      templateId,
      title: title.trim() || '未命名台账',
      description: '',
      fieldValues: {},
      experienceIds: [],
      captureIds: [],
      createdAt: now(),
      updatedAt: now(),
    });
    setChoosing(false);
    setTemplateId('');
    setTitle('');
    reload();
    navigate(`/collections/${id}`);
  };

  const handleQuickImport = async (file: File) => {
    try {
      const res = await importBackup(file, 'merge');
      toast(
        `增量导入完成：新增 ${res.experiencesAdded} 条经历、合并 ${res.experiencesMerged} 条，新增 ${res.capturesAdded} 条资料`,
      );
      reload();
    } catch (e) {
      toast(`导入失败：${String(e)}`);
    }
  };

  return (
    <div className="page">
      <PageHead
        title="台账与模板"
        subtitle="同一份原始资料只存一次，按竞赛、旅行、项目等台账视角随时查阅、核验与导出"
        actions={
          <>
            <button className="btn" onClick={() => importRef.current?.click()}>
              <Upload size={15} /> 增量导入台账 ZIP
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".zip"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleQuickImport(f);
                e.target.value = '';
              }}
            />
            <button className="btn primary" onClick={() => setChoosing(true)}>
              <Plus size={15} /> 新建台账
            </button>
          </>
        }
      />

      <section className="section-block">
        <div className="section-head">
          <h2 className="section-title">我的台账</h2>
          <span className="muted small">{collections.length} 个集合</span>
        </div>

        {collections.length === 0 ? (
          <Empty
            icon={<LayoutGrid size={34} />}
            title="还没有建立台账"
            desc="你可以直接点击右上角「增量导入台账 ZIP」导入现有的竞赛台账包，或者从下方模板新建一个。"
            action={
              <div className="row-gap" style={{ justifyContent: 'center' }}>
                <button className="btn" onClick={() => importRef.current?.click()}>
                  <Upload size={15} /> 导入现有台账 ZIP
                </button>
                <button
                  className="btn primary"
                  onClick={() => {
                    setTemplateId('tpl-competition');
                    setTitle('全部竞赛经历');
                    setChoosing(true);
                  }}
                >
                  <Trophy size={15} /> 创建竞赛台账
                </button>
              </div>
            }
          />
        ) : (
          <div className="collection-cards">
            {collections.map((c) => {
              const t = templates.find((x) => x.id === c.templateId);
              const Icon = iconMap[t?.icon ?? ''] ?? LayoutGrid;
              const members = c.experienceIds
                .map((eid) => expMap.get(eid))
                .filter(Boolean) as Experience[];
              const isComp = c.templateId === 'tpl-competition';
              const awardedCount = isComp ? members.filter(isAwarded).length : 0;
              const missingCertCount = isComp
                ? members.filter((e) => auditCompetition(e).missingCertificate).length
                : 0;

              return (
                <button
                  key={c.id}
                  className="collection-card"
                  onClick={() => navigate(`/collections/${c.id}`)}
                >
                  <div className="collection-card-top">
                    <div className={`collection-card-icon ${isComp ? 'is-gold' : ''}`}>
                      <Icon size={20} />
                    </div>
                    <Chip tone={isComp ? 'gold' : 'accent'}>{t?.name ?? '自定义'}</Chip>
                  </div>
                  <div className="collection-card-title">{c.title}</div>
                  <p className="collection-card-desc">
                    {c.description || t?.description || '点击查看台账明细与佐证材料'}
                  </p>
                  <div className="collection-card-foot">
                    <span>
                      <strong>{c.experienceIds.length}</strong> 条经历
                    </span>
                    {isComp ? (
                      <>
                        <span>
                          <strong>{awardedCount}</strong> 项获奖
                        </span>
                        {missingCertCount > 0 && (
                          <span className="text-danger">{missingCertCount} 缺证书</span>
                        )}
                      </>
                    ) : (
                      <span>
                        <strong>{c.captureIds.length}</strong> 条资料
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-head">
          <h2 className="section-title">可用模板</h2>
          <span className="muted small">选择模板快速搭建新台账</span>
        </div>
        <div className="template-grid">
          {templates.map((t) => {
            const Icon = iconMap[t.icon] ?? LayoutGrid;
            return (
              <div key={t.id} className="template-card">
                <div className="template-icon">
                  <Icon size={19} />
                </div>
                <div className="template-info">
                  <strong>{t.name}</strong>
                  <p>{t.description}</p>
                </div>
                <button
                  className="btn small"
                  onClick={() => {
                    setTemplateId(t.id);
                    setTitle('');
                    setChoosing(true);
                  }}
                >
                  使用
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {choosing && (
        <Modal title="新建台账集合" onClose={() => setChoosing(false)}>
          <Field label="选择模板">
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">请选择模板</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="台账名称">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：全部竞赛经历 / 2026 杭州旅行"
            />
          </Field>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setChoosing(false)}>
              取消
            </button>
            <button className="btn primary" disabled={!templateId} onClick={() => void create()}>
              创建并进入
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

type ViewTab = 'table' | 'timeline' | 'settings';
type QuickAuditFilter = 'all' | 'missingCert' | 'missingDate' | 'missingGrade' | 'awarded' | 'hasEvidence';
type SortMode = 'dateDesc' | 'dateAsc' | 'grade' | 'issues';

const GRADE_ORDER: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C: 5, 待确认: 9 };

export function CollectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [col, setCol] = useState<Collection | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [tab, setTab] = useState<ViewTab>('table');
  const [pickOpen, setPickOpen] = useState(false);
  const [memberType, setMemberType] = useState<'experience' | 'capture'>('experience');

  // 台账筛选状态
  const [query, setQuery] = useState('');
  const [auditFilter, setAuditFilter] = useState<QuickAuditFilter>('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('dateDesc');

  // 快速补图弹窗状态
  const [quickEvidenceExp, setQuickEvidenceExp] = useState<Experience | null>(null);
  const [quickSlot, setQuickSlot] = useState<string>('证书照片');
  const quickFileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const reloadAll = async () => {
    if (!id) return;
    const [c, exps, caps] = await Promise.all([
      db.collections.get(id),
      db.experiences.toArray(),
      db.captures.toArray(),
    ]);
    setCol(c ?? null);
    setExperiences(exps);
    setCaptures(caps);
    if (c) {
      const t = await db.templates.get(c.templateId);
      setTemplate(t ?? null);
      if (c.templateId !== 'tpl-competition') {
        setTab((prev) => (prev === 'table' ? 'timeline' : prev));
      }
    }
  };

  useEffect(() => {
    void reloadAll();
  }, [id]);

  const isCompetition = col?.templateId === 'tpl-competition';

  const memberExperiences = useMemo(() => {
    if (!col) return [];
    const idSet = new Set(col.experienceIds);
    return experiences.filter((e) => idSet.has(e.id));
  }, [col, experiences]);

  // 统计 KPI
  const kpi = useMemo(() => {
    const total = memberExperiences.length;
    let awarded = 0;
    let aClass = 0;
    let missingCert = 0;
    let missingDate = 0;
    let missingGrade = 0;
    let hasEvidence = 0;

    for (const e of memberExperiences) {
      const a = auditCompetition(e);
      if (isAwarded(e)) awarded += 1;
      const gb = getGradeBucket(getCompField(e, '湖大分级'));
      if (gb === 'A1' || gb === 'A2') aClass += 1;
      if (a.missingCertificate) missingCert += 1;
      if (a.missingDate) missingDate += 1;
      if (a.missingGrade) missingGrade += 1;
      if (!a.missingAnyEvidence) hasEvidence += 1;
    }
    return { total, awarded, aClass, missingCert, missingDate, missingGrade, hasEvidence };
  }, [memberExperiences]);

  // 下拉选项
  const groupOptions = useMemo(() => {
    const set = new Set(memberExperiences.map(getExperienceGroup));
    return Array.from(set).sort();
  }, [memberExperiences]);

  const yearOptions = useMemo(() => {
    const set = new Set(
      memberExperiences
        .map((e) => e.startAt?.slice(0, 4))
        .filter((y): y is string => Boolean(y && /^\d{4}$/.test(y))),
    );
    return Array.from(set).sort().reverse();
  }, [memberExperiences]);

  // 筛选与排序后的台账行
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = memberExperiences.filter((e) => {
      const audit = auditCompetition(e);
      if (auditFilter === 'missingCert' && !audit.missingCertificate) return false;
      if (auditFilter === 'missingDate' && !audit.missingDate) return false;
      if (auditFilter === 'missingGrade' && !audit.missingGrade) return false;
      if (auditFilter === 'awarded' && !isAwarded(e)) return false;
      if (auditFilter === 'hasEvidence' && audit.missingAnyEvidence) return false;

      if (groupFilter !== 'all' && getExperienceGroup(e) !== groupFilter) return false;
      if (gradeFilter !== 'all' && getGradeBucket(getCompField(e, '湖大分级')) !== gradeFilter)
        return false;
      if (yearFilter !== 'all') {
        if (yearFilter === 'unknown') {
          if (e.startAt && /^\d{4}/.test(e.startAt)) return false;
        } else if (!e.startAt?.startsWith(yearFilter)) {
          return false;
        }
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

    return list.sort((a, b) => {
      if (sortMode === 'grade') {
        const ga = GRADE_ORDER[getGradeBucket(getCompField(a, '湖大分级'))] ?? 9;
        const gb = GRADE_ORDER[getGradeBucket(getCompField(b, '湖大分级'))] ?? 9;
        if (ga !== gb) return ga - gb;
        return (b.startAt ?? '').localeCompare(a.startAt ?? '');
      }
      if (sortMode === 'issues') {
        const ia = auditCompetition(a).issues.length;
        const ib = auditCompetition(b).issues.length;
        if (ia !== ib) return ib - ia;
        return (b.startAt ?? '').localeCompare(a.startAt ?? '');
      }
      const da = a.startAt ?? '';
      const dbStr = b.startAt ?? '';
      const hasA = /^\d{4}/.test(da) ? 1 : 0;
      const hasB = /^\d{4}/.test(dbStr) ? 1 : 0;
      if (hasA !== hasB) return hasB - hasA;
      return sortMode === 'dateAsc' ? da.localeCompare(dbStr) : dbStr.localeCompare(da);
    });
  }, [memberExperiences, query, auditFilter, groupFilter, gradeFilter, yearFilter, sortMode]);

  // 穿插时间线成员
  type TimelineMember = {
    key: string;
    kind: 'experience' | 'capture';
    date: string;
    title: string;
    desc: string;
    exp?: Experience;
    capture?: Capture;
  };
  const timelineMembers = useMemo<TimelineMember[]>(() => {
    if (!col) return [];
    const ex: TimelineMember[] = memberExperiences.map((e) => ({
      key: `e-${e.id}`,
      kind: 'experience',
      date: e.startAt ?? '未定时间',
      title: e.title,
      desc: e.description || getCompField(e, '奖项') || getCompField(e, '备注'),
      exp: e,
    }));
    const ca: TimelineMember[] = captures
      .filter((c) => col.captureIds.includes(c.id))
      .map((c) => ({
        key: `c-${c.id}`,
        kind: 'capture',
        date: captureSortKey(c),
        title: c.title,
        desc: c.note,
        capture: c,
      }));
    return [...ex, ...ca].sort((a, b) => {
      const ha = /^\d{4}/.test(a.date) ? 1 : 0;
      const hb = /^\d{4}/.test(b.date) ? 1 : 0;
      if (ha !== hb) return hb - ha;
      return b.date.localeCompare(a.date);
    });
  }, [col, memberExperiences, captures]);

  if (!col) {
    return (
      <div className="page">
        <Empty icon={<LayoutGrid size={34} />} title="台账不存在" desc="它可能已被删除。" />
      </div>
    );
  }

  const updateCollection = async (next: Collection) => {
    setCol(next);
    await recordHistory('collection', next.id, col);
    await db.collections.put({ ...next, updatedAt: now() });
  };

  const toggleMember = async (memberId: string) => {
    if (memberType === 'experience') {
      const ids = col.experienceIds.includes(memberId)
        ? col.experienceIds.filter((x) => x !== memberId)
        : [...col.experienceIds, memberId];
      await updateCollection({ ...col, experienceIds: ids });
    } else {
      const ids = col.captureIds.includes(memberId)
        ? col.captureIds.filter((x) => x !== memberId)
        : [...col.captureIds, memberId];
      await updateCollection({ ...col, captureIds: ids });
    }
  };

  const createRecordInCollection = async () => {
    const newId = uid();
    const newExp: Experience = {
      id: newId,
      title: isCompetition ? '新竞赛记录' : '新经历记录',
      description: '',
      startAt: undefined,
      endAt: undefined,
      timePrecision: 'unknown',
      location: '',
      status: 'active',
      tags: isCompetition ? ['竞赛'] : [],
      captureIds: [],
      templateId: col.templateId,
      customFields: {},
      evidenceSlots: {},
      createdAt: now(),
      updatedAt: now(),
    };
    await db.experiences.put(newExp);
    await updateCollection({
      ...col,
      experienceIds: [newId, ...col.experienceIds],
    });
    navigate(`/experiences/${newId}`, { state: { from: `/collections/${col.id}` } });
  };

  const attachFilesToQuickExp = async (files: FileList | File[]) => {
    if (!quickEvidenceExp) return;
    const list = Array.from(files);
    if (list.length === 0) return;

    const addedIds: string[] = [];
    const addedTitles: string[] = [];
    let dedupCount = 0;

    for (const f of list) {
      const { capture, deduplicated } = await saveFileCaptureDedup(f, 'ledger_slot');
      addedIds.push(capture.id);
      addedTitles.push(capture.title);
      if (deduplicated) dedupCount += 1;
    }

    const prevSlots = quickEvidenceExp.evidenceSlots ?? {};
    const nextSlotIds = Array.from(new Set([...(prevSlots[quickSlot] ?? []), ...addedIds]));
    const nextCapIds = Array.from(new Set([...quickEvidenceExp.captureIds, ...addedIds]));
    const prevSlotText = getCompField(quickEvidenceExp, quickSlot);
    const mergedText = Array.from(
      new Set([
        ...(prevSlotText ? prevSlotText.split(/[,，;；]\s*/).filter(Boolean) : []),
        ...addedTitles,
      ]),
    ).join('，');

    const updatedExp: Experience = {
      ...quickEvidenceExp,
      captureIds: nextCapIds,
      evidenceSlots: { ...prevSlots, [quickSlot]: nextSlotIds },
      customFields: { ...(quickEvidenceExp.customFields ?? {}), [quickSlot]: mergedText },
      updatedAt: now(),
    };

    await recordHistory('experience', updatedExp.id, quickEvidenceExp);
    await db.experiences.put(updatedExp);
    setQuickEvidenceExp(updatedExp);
    await reloadAll();
    toast(
      `已挂载 ${addedIds.length} 份材料到「${quickSlot}」${dedupCount ? `（其中 ${dedupCount} 份复用已有原件）` : ''}`,
    );
  };

  const handleExportEvidence = async () => {
    const count = await exportEvidenceZip(filteredRows, captures, `${col.title}-佐证材料`);
    if (count === 0) {
      toast('当前筛选结果里还没有挂载本地图片/文件，可先点击行尾「补图」挂载证书');
    } else {
      toast(`已打包导出 ${count} 份佐证原件`);
    }
  };

  const handleMergeImport = async (file: File) => {
    try {
      const res = await importBackup(file, 'merge');
      await reloadAll();
      toast(`增量导入成功：新增 ${res.experiencesAdded} 条、合并 ${res.experiencesMerged} 条经历`);
    } catch (e) {
      toast(`导入失败：${String(e)}`);
    }
  };

  const resetFilters = () => {
    setQuery('');
    setAuditFilter('all');
    setGroupFilter('all');
    setGradeFilter('all');
    setYearFilter('all');
  };

  return (
    <div className="page page-wide">
      <button className="btn ghost back" onClick={() => navigate('/collections')}>
        <ArrowLeft size={15} /> 返回台账列表
      </button>

      <PageHead
        title={col.title}
        subtitle={
          col.description ||
          (isCompetition
            ? '按条目管理竞赛时间、湖大分级、奖项排名与证书原件，支持缺项体检与一键交表'
            : template?.description || '自定义台账集合')
        }
        badge={<Chip tone={isCompetition ? 'gold' : 'accent'}>{template?.name ?? '自定义'}</Chip>}
        actions={
          <>
            <button className="btn primary" onClick={() => void createRecordInCollection()}>
              <Plus size={15} /> 新增记录
            </button>
            {isCompetition && (
              <>
                <button
                  className="btn"
                  onClick={() => {
                    exportCompetitionCSV(filteredRows, col.title);
                    toast(`已导出 ${filteredRows.length} 条记录为 CSV（Excel 可直接打开）`);
                  }}
                >
                  <FileSpreadsheet size={15} /> 导出 CSV
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    exportCompetitionMarkdown(filteredRows, col.title);
                    toast(`已导出 ${filteredRows.length} 条记录为 Markdown 简历表`);
                  }}
                >
                  <FileText size={15} /> 导出 MD
                </button>
                <button className="btn" onClick={() => void handleExportEvidence()}>
                  <FolderArchive size={15} /> 打包佐证
                </button>
              </>
            )}
            <button className="btn" onClick={() => importRef.current?.click()}>
              <Upload size={15} /> 增量导入
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".zip"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleMergeImport(f);
                e.target.value = '';
              }}
            />
            <button className="btn ghost" onClick={() => setPickOpen(true)}>
              <Link2 size={15} /> 管理成员
            </button>
          </>
        }
      />

      {isCompetition && (
        <div className="kpi-strip">
          <StatCard
            label="台账总计"
            value={kpi.total}
            sub={`已挂佐证 ${kpi.hasEvidence} 条`}
            tone="neutral"
            active={auditFilter === 'all'}
            onClick={() => setAuditFilter('all')}
          />
          <StatCard
            label="已获奖项"
            value={kpi.awarded}
            sub={`A 类竞赛 ${kpi.aClass} 项`}
            tone="gold"
            active={auditFilter === 'awarded'}
            onClick={() => setAuditFilter(auditFilter === 'awarded' ? 'all' : 'awarded')}
          />
          <StatCard
            label="缺证书佐证"
            value={kpi.missingCert}
            sub="已获奖但未挂证书"
            tone={kpi.missingCert > 0 ? 'warn' : 'emerald'}
            active={auditFilter === 'missingCert'}
            onClick={() => setAuditFilter(auditFilter === 'missingCert' ? 'all' : 'missingCert')}
          />
          <StatCard
            label="时间待确认"
            value={kpi.missingDate}
            sub={`分级待确认 ${kpi.missingGrade} 项`}
            tone="accent"
            active={auditFilter === 'missingDate'}
            onClick={() => setAuditFilter(auditFilter === 'missingDate' ? 'all' : 'missingDate')}
          />
        </div>
      )}

      <div className="view-bar">
        <div className="segmented">
          <button
            className={`seg-btn ${tab === 'table' ? 'active' : ''}`}
            onClick={() => setTab('table')}
          >
            <Table2 size={15} /> 台账表格
          </button>
          <button
            className={`seg-btn ${tab === 'timeline' ? 'active' : ''}`}
            onClick={() => setTab('timeline')}
          >
            <BookOpen size={15} /> 穿插时间线
          </button>
          <button
            className={`seg-btn ${tab === 'settings' ? 'active' : ''}`}
            onClick={() => setTab('settings')}
          >
            <Settings size={15} /> 集合设置
          </button>
        </div>
        {tab === 'table' && (
          <div className="muted small">
            当前显示 <strong>{filteredRows.length}</strong> / {memberExperiences.length} 条记录
          </div>
        )}
      </div>

      {tab === 'table' && (
        <div className="ledger-shell">
          <div className="ledger-controls">
            <div className="search-box">
              <Search size={15} />
              <input
                placeholder="搜索竞赛名、奖项、颁奖单位、备注…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="ledger-selects">
              {isCompetition && (
                <>
                  <select
                    className="select compact"
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                  >
                    <option value="all">全部分组</option>
                    {groupOptions.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>

                  <select
                    className="select compact"
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                  >
                    <option value="all">全部湖大分级</option>
                    {(['A1', 'A2', 'B1', 'B2', 'C', '待确认'] as const).map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <select
                className="select compact"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
              >
                <option value="all">全部年份</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y} 年
                  </option>
                ))}
                <option value="unknown">时间待确认</option>
              </select>

              <select
                className="select compact"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
              >
                <option value="dateDesc">按时间最新</option>
                <option value="dateAsc">按时间最早</option>
                {isCompetition && <option value="grade">按湖大分级优先</option>}
                {isCompetition && <option value="issues">按待补齐项优先</option>}
              </select>
            </div>
          </div>

          {isCompetition && (
            <div className="audit-chips">
              {(
                [
                  ['all', `全部 (${kpi.total})`],
                  ['missingCert', `缺证书 (${kpi.missingCert})`],
                  ['missingDate', `时间待确认 (${kpi.missingDate})`],
                  ['missingGrade', `分级待确认 (${kpi.missingGrade})`],
                  ['awarded', `已获奖 (${kpi.awarded})`],
                  ['hasEvidence', `已挂图 (${kpi.hasEvidence})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={`filter-btn ${auditFilter === key ? 'active' : ''}`}
                  onClick={() => setAuditFilter(key)}
                >
                  {label}
                </button>
              ))}
              {(query || auditFilter !== 'all' || groupFilter !== 'all' || gradeFilter !== 'all' || yearFilter !== 'all') && (
                <button className="btn ghost small" onClick={resetFilters}>
                  重置筛选
                </button>
              )}
            </div>
          )}

          {filteredRows.length === 0 ? (
            <Empty
              icon={<Table2 size={32} />}
              title="没有匹配的台账记录"
              desc="换个关键词或清空筛选条件试试，也可以直接新增一条记录。"
              action={
                <button className="btn" onClick={resetFilters}>
                  重置筛选
                </button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th style={{ width: 108 }}>时间</th>
                    <th>竞赛 / 经历名称</th>
                    {isCompetition && <th style={{ width: 106 }}>湖大分级</th>}
                    {isCompetition && <th style={{ width: 180 }}>奖项与成绩</th>}
                    <th style={{ width: 150 }}>佐证与体检</th>
                    <th style={{ width: 120, textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((e) => {
                    const audit = auditCompetition(e);
                    const grade = getCompField(e, '湖大分级');
                    const award = getCompField(e, '奖项');
                    const scoreRank = [getCompField(e, '成绩'), getCompField(e, '排名')]
                      .filter(Boolean)
                      .join(' · ');
                    const group = getExperienceGroup(e);

                    return (
                      <tr
                        key={e.id}
                        className="ledger-row"
                        onClick={() =>
                          navigate(`/experiences/${e.id}`, {
                            state: { from: `/collections/${col.id}` },
                          })
                        }
                      >
                        <td className="col-date">
                          <span className={!e.startAt ? 'muted' : 'tabular'}>
                            {e.startAt ?? '待确认'}
                          </span>
                        </td>
                        <td>
                          <div className="cell-title">{e.title}</div>
                          <div className="cell-sub">
                            <Chip>{group}</Chip>
                            {getCompField(e, '颁奖单位') && (
                              <span className="muted truncate-inline">
                                {getCompField(e, '颁奖单位')}
                              </span>
                            )}
                          </div>
                        </td>
                        {isCompetition && (
                          <td>
                            <Chip tone={gradeTone(grade)}>{grade || '待确认'}</Chip>
                          </td>
                        )}
                        {isCompetition && (
                          <td>
                            <div className="cell-award">
                              {award ? (
                                <strong>{award}</strong>
                              ) : isAwarded(e) ? (
                                <span className="muted">已获奖（待填奖项）</span>
                              ) : (
                                <span className="muted">—</span>
                              )}
                            </div>
                            {scoreRank && <div className="cell-sub muted tabular">{scoreRank}</div>}
                          </td>
                        )}
                        <td>
                          <div className="cell-evidence">
                            {audit.evidenceCount > 0 ? (
                              <Chip tone="emerald">
                                <ImageIcon size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
                                {audit.evidenceCount} 份原件
                              </Chip>
                            ) : (
                              <Chip tone={audit.missingCertificate ? 'danger' : 'neutral'}>
                                {audit.missingCertificate ? '缺证书' : '暂无原件'}
                              </Chip>
                            )}
                            {audit.missingDate && <Chip tone="warn">缺日期</Chip>}
                          </div>
                        </td>
                        <td
                          className="col-actions"
                          onClick={(ev) => {
                            ev.stopPropagation();
                          }}
                        >
                          <button
                            className="btn small"
                            title="直接为此条记录上传证书/奖牌/合照"
                            onClick={() => {
                              setQuickEvidenceExp(e);
                              setQuickSlot('证书照片');
                            }}
                          >
                            <UploadCloud size={13} /> 补图
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'timeline' && (
        <div className="panel">
          <div className="panel-head">
            <h3>穿插时间线</h3>
            <span className="muted small">经历与照片按时间倒序排列，时间待确认项排在末尾</span>
          </div>
          {timelineMembers.length === 0 ? (
            <p className="muted">还没有成员，点击右上角「新增记录」或「管理成员」添加。</p>
          ) : (
            <div className="story">
              {timelineMembers.map((m) => (
                <div
                  key={m.key}
                  className={`story-item ${m.exp ? 'clickable-story' : ''}`}
                  onClick={() => {
                    if (m.exp) {
                      navigate(`/experiences/${m.exp.id}`, {
                        state: { from: `/collections/${col.id}` },
                      });
                    }
                  }}
                >
                  <div className="story-date tabular">{m.date}</div>
                  <div className="story-body">
                    <div className="row-gap">
                      <strong>{m.title}</strong>
                      {m.exp && isCompetition && getCompField(m.exp, '湖大分级') && (
                        <Chip tone={gradeTone(getCompField(m.exp, '湖大分级'))}>
                          {getCompField(m.exp, '湖大分级')}
                        </Chip>
                      )}
                      {m.exp && isCompetition && getCompField(m.exp, '奖项') && (
                        <Chip tone="gold">{getCompField(m.exp, '奖项')}</Chip>
                      )}
                    </div>
                    {m.capture && <CaptureThumb capture={m.capture} />}
                    {m.desc && <p>{m.desc}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="panel" style={{ maxWidth: 680 }}>
          <h3>集合基本信息</h3>
          <Field label="台账标题">
            <input
              value={col.title}
              onChange={(e) => void updateCollection({ ...col, title: e.target.value })}
            />
          </Field>
          <Field label="台账说明">
            <textarea
              rows={3}
              value={col.description}
              onChange={(e) => void updateCollection({ ...col, description: e.target.value })}
              placeholder="例如：本科期间全部学科竞赛与荣誉记录，用于综测、保研与简历整理"
            />
          </Field>
          <p className="hint-box">
            <AlertCircle size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            每一条竞赛的具体字段（湖大分级、奖项、排名、证书槽位）保存在单条经历中，点击台账表格任意一行即可编辑。
          </p>
        </div>
      )}

      {quickEvidenceExp && (
        <Modal
          title="快速补充佐证材料"
          subtitle={quickEvidenceExp.title}
          onClose={() => setQuickEvidenceExp(null)}
        >
          <Field label="放入哪个佐证槽位">
            <div className="filters">
              {EVIDENCE_SLOTS.map((slot) => (
                <button
                  key={slot.key}
                  type="button"
                  className={`filter-btn ${quickSlot === slot.key ? 'active' : ''}`}
                  onClick={() => setQuickSlot(slot.key)}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </Field>

          <div
            className="dropzone compact-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length) void attachFilesToQuickExp(e.dataTransfer.files);
            }}
            onClick={() => quickFileRef.current?.click()}
          >
            <UploadCloud size={24} />
            <strong>拖入或点击上传图片 / PDF</strong>
            <span className="muted small">自动写入收件箱、按 SHA-256 去重并关联到此竞赛</span>
            <input
              ref={quickFileRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              hidden
              onChange={(e) => {
                if (e.target.files?.length) void attachFilesToQuickExp(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          <div className="modal-actions">
            <button
              className="btn"
              onClick={() => {
                const targetId = quickEvidenceExp.id;
                setQuickEvidenceExp(null);
                navigate(`/experiences/${targetId}`, { state: { from: `/collections/${col.id}` } });
              }}
            >
              打开完整编辑页
            </button>
            <button className="btn primary" onClick={() => setQuickEvidenceExp(null)}>
              完成
            </button>
          </div>
        </Modal>
      )}

      {pickOpen && (
        <Modal title="管理台账成员" onClose={() => setPickOpen(false)} wide>
          <div className="filters">
            <button
              className={`filter-btn ${memberType === 'experience' ? 'active' : ''}`}
              onClick={() => setMemberType('experience')}
            >
              经历 ({experiences.length})
            </button>
            <button
              className={`filter-btn ${memberType === 'capture' ? 'active' : ''}`}
              onClick={() => setMemberType('capture')}
            >
              独立资料 ({captures.length})
            </button>
          </div>
          <div className="picker">
            {(memberType === 'experience' ? experiences : captures).map((m) => {
              const checked =
                memberType === 'experience'
                  ? col.experienceIds.includes(m.id)
                  : col.captureIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  className={`picker-row ${checked ? 'checked' : ''}`}
                  onClick={() => void toggleMember(m.id)}
                >
                  <span className="picker-check">{checked ? '✓' : ''}</span>
                  <span className="picker-name">{m.title}</span>
                </button>
              );
            })}
          </div>
          <div className="modal-actions">
            <button
              className="btn primary"
              onClick={() => {
                setPickOpen(false);
                toast('成员已更新');
              }}
            >
              完成
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
