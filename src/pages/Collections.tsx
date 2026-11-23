import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  GraduationCap,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Map as MapIcon,
  Plus,
  Printer,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Table2,
  Trophy,
  Upload,
  UploadCloud,
  X,
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
import { resolveCaptureBlob } from '../lib/tauriBridge';
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
  setCompField,
} from '../lib/competition';
import { exportProofPortfolioPdf } from '../lib/pdfExport';
import { Chip, DropdownMenu, Empty, Field, Modal, PageHead, StatCard, useToast } from '../components/common';

const iconMap: Record<string, typeof Trophy> = {
  Trophy,
  Map: MapIcon,
  Briefcase,
  GraduationCap,
  Sparkles,
  BookOpen,
  ShieldCheck,
};

function CaptureThumb({ capture, className = 'story-image' }: { capture: Capture; className?: string }) {
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

  if (url) return <img className={className} src={url} alt={capture.title} />;
  return null;
}

function getCredentialBadge(exp: Experience): { label: string; tone: 'danger' | 'warn' | 'emerald' | 'neutral' } {
  const raw = (exp.customFields?.['有效期至'] ?? '').trim();
  if (!raw) return { label: '长期有效', tone: 'emerald' };
  const target = new Date(raw.slice(0, 10));
  if (Number.isNaN(target.getTime())) return { label: raw, tone: 'neutral' };
  const days = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: `已过期 ${Math.abs(days)} 天`, tone: 'danger' };
  if (days <= 90) return { label: `剩 ${days} 天到期`, tone: 'warn' };
  return { label: `至 ${raw.slice(0, 10)}`, tone: 'emerald' };
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
        subtitle="竞赛、证件与资质、STAR 项目、旅行游记统一复用台账表格与佐证槽位"
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
                        <strong>{c.captureIds.length}</strong> 条独立资料
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
          <span className="muted small">所有模板均支持表格视图、右侧快编与佐证挂载</span>
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
              placeholder="例如：个人证件夹 / 开源与课程项目台账"
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

  // PDF 证明册弹窗状态
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfRedact, setPdfRedact] = useState(true);
  const [pdfIncludeImages, setPdfIncludeImages] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);

  // 右侧滑出快编抽屉状态
  const [drawerExp, setDrawerExp] = useState<Experience | null>(null);
  const [drawerSlot, setDrawerSlot] = useState<string>('证书照片');
  const drawerFileRef = useRef<HTMLInputElement>(null);
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
    }
  };

  useEffect(() => {
    void reloadAll();
  }, [id]);

  const isCompetition = col?.templateId === 'tpl-competition';
  const isCredential = col?.templateId === 'tpl-credential';
  const isProject = col?.templateId === 'tpl-project';
  const captureMap = useMemo(() => new Map(captures.map((c) => [c.id, c])), [captures]);

  const memberExperiences = useMemo(() => {
    if (!col) return [];
    const idSet = new Set(col.experienceIds);
    return experiences.filter((e) => idSet.has(e.id));
  }, [col, experiences]);

  const kpi = useMemo(() => {
    const total = memberExperiences.length;
    let awarded = 0;
    let a1 = 0;
    let a2 = 0;
    let bClass = 0;
    let unknownGrade = 0;
    let missingCert = 0;
    let missingDate = 0;
    let hasEvidence = 0;

    for (const e of memberExperiences) {
      const a = auditCompetition(e);
      if (isAwarded(e)) awarded += 1;
      const gb = getGradeBucket(getCompField(e, '湖大分级'));
      if (gb === 'A1') a1 += 1;
      else if (gb === 'A2') a2 += 1;
      else if (gb === 'B1' || gb === 'B2') bClass += 1;
      else unknownGrade += 1;

      if (a.missingCertificate) missingCert += 1;
      if (a.missingDate) missingDate += 1;
      if (!a.missingAnyEvidence) hasEvidence += 1;
    }
    return {
      total,
      awarded,
      a1,
      a2,
      bClass,
      unknownGrade,
      aClass: a1 + a2,
      missingCert,
      missingDate,
      missingGrade: unknownGrade,
      hasEvidence,
    };
  }, [memberExperiences]);

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

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = memberExperiences.filter((e) => {
      const audit = auditCompetition(e);
      if (isCompetition) {
        if (auditFilter === 'missingCert' && !audit.missingCertificate) return false;
        if (auditFilter === 'missingDate' && !audit.missingDate) return false;
        if (auditFilter === 'missingGrade' && !audit.missingGrade) return false;
        if (auditFilter === 'awarded' && !isAwarded(e)) return false;
        if (auditFilter === 'hasEvidence' && audit.missingAnyEvidence) return false;

        if (groupFilter !== 'all' && getExperienceGroup(e) !== groupFilter) return false;
        if (gradeFilter !== 'all' && getGradeBucket(getCompField(e, '湖大分级')) !== gradeFilter)
          return false;
      }

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
      if (isCompetition && sortMode === 'grade') {
        const ga = GRADE_ORDER[getGradeBucket(getCompField(a, '湖大分级'))] ?? 9;
        const gb = GRADE_ORDER[getGradeBucket(getCompField(b, '湖大分级'))] ?? 9;
        if (ga !== gb) return ga - gb;
        return (b.startAt ?? '').localeCompare(a.startAt ?? '');
      }
      if (isCompetition && sortMode === 'issues') {
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
  }, [memberExperiences, isCompetition, query, auditFilter, groupFilter, gradeFilter, yearFilter, sortMode]);

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
    const defaultTitle = isCompetition
      ? '新竞赛记录'
      : isCredential
        ? '新证件记录'
        : isProject
          ? '新项目记录'
          : '新经历记录';
    const newExp: Experience = {
      id: newId,
      title: defaultTitle,
      description: '',
      startAt: undefined,
      endAt: undefined,
      timePrecision: 'unknown',
      location: '',
      status: 'active',
      tags: template ? [template.name] : [],
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

  const saveDrawerExp = async () => {
    if (!drawerExp) return;
    await recordHistory('experience', drawerExp.id, drawerExp);
    const updated = { ...drawerExp, updatedAt: now() };
    await db.experiences.put(updated);
    setDrawerExp(updated);
    await reloadAll();
    toast('已保存修改');
  };

  const attachFilesToDrawerExp = async (files: FileList | File[]) => {
    if (!drawerExp) return;
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

    const prevSlots = drawerExp.evidenceSlots ?? {};
    const nextSlotIds = Array.from(new Set([...(prevSlots[drawerSlot] ?? []), ...addedIds]));
    const nextCapIds = Array.from(new Set([...drawerExp.captureIds, ...addedIds]));
    const prevSlotText = getCompField(drawerExp, drawerSlot);
    const mergedText = Array.from(
      new Set([
        ...(prevSlotText ? prevSlotText.split(/[,，;；]\s*/).filter(Boolean) : []),
        ...addedTitles,
      ]),
    ).join('，');

    const updatedExp: Experience = {
      ...drawerExp,
      captureIds: nextCapIds,
      evidenceSlots: { ...prevSlots, [drawerSlot]: nextSlotIds },
      customFields: setCompField(drawerExp, drawerSlot, mergedText),
      updatedAt: now(),
    };

    await recordHistory('experience', updatedExp.id, drawerExp);
    await db.experiences.put(updatedExp);
    setDrawerExp(updatedExp);
    await reloadAll();
    toast(
      `已挂载 ${addedIds.length} 份材料到「${drawerSlot}」${dedupCount ? `（其中 ${dedupCount} 份复用已有原件）` : ''}`,
    );
  };

  const handleExportEvidence = async () => {
    const count = await exportEvidenceZip(filteredRows, captures, `${col.title}-佐证材料`);
    if (count === 0) {
      toast('当前筛选结果里还没有挂载本地图片/文件，点任意行即可在右侧抽屉快速补图');
    } else {
      toast(`已打包导出 ${count} 份佐证原件`);
    }
  };

  const handleExportPdf = async () => {
    setPdfBusy(true);
    try {
      const res = await exportProofPortfolioPdf(filteredRows, captures, {
        title: col.title,
        subtitle: col.description || `${template?.name ?? '个人'}经历证明汇编`,
        applyRedaction: pdfRedact,
        includeImages: pdfIncludeImages,
      });
      setPdfOpen(false);
      toast(
        res.openedPrintWindow
          ? `已生成证明汇编（${res.totalRecords} 条记录、${res.embeddedImages} 张佐证图），请在打印窗口选择「另存为 PDF」`
          : `已下载证明汇编 HTML（${res.totalRecords} 条记录），用浏览器打开打印即可保存 PDF`,
      );
    } catch (e) {
      toast(`生成失败：${String(e)}`);
    } finally {
      setPdfBusy(false);
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

  const pct = (n: number) => (kpi.total > 0 ? `${Math.round((n / kpi.total) * 100)}%` : '0%');

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
            ? '点击任意行即可在右侧抽屉快速核验分级、奖项与补传证书，支持一键导出 PDF 证明册'
            : template?.description || '自定义台账集合')
        }
        badge={<Chip tone={isCompetition ? 'gold' : 'accent'}>{template?.name ?? '自定义'}</Chip>}
        actions={
          <>
            <button className="btn primary" onClick={() => void createRecordInCollection()}>
              <Plus size={15} /> 新增记录
            </button>
            <DropdownMenu
              label="导出"
              icon={<Download size={15} />}
              items={[
                {
                  label: '导出 PDF 证明册',
                  hint: '封面 + 目录表 + 脱敏证书附页',
                  icon: <Printer size={15} />,
                  onClick: () => setPdfOpen(true),
                },
                ...(isCompetition
                  ? [
                      {
                        label: '导出 CSV 表格',
                        hint: 'Excel 直接打开，适合综测与交表',
                        icon: <FileSpreadsheet size={15} />,
                        onClick: () => {
                          exportCompetitionCSV(filteredRows, col.title);
                          toast(`已导出 ${filteredRows.length} 条记录为 CSV`);
                        },
                      },
                      {
                        label: '导出 Markdown 简历表',
                        hint: '直接粘贴到简历或个人主页',
                        icon: <FileText size={15} />,
                        onClick: () => {
                          exportCompetitionMarkdown(filteredRows, col.title);
                          toast(`已导出 ${filteredRows.length} 条记录为 Markdown`);
                        },
                      },
                      {
                        label: '打包佐证原件 ZIP',
                        hint: '按「年月-比赛-奖项」自动分文件夹',
                        icon: <FolderArchive size={15} />,
                        onClick: () => void handleExportEvidence(),
                      },
                    ]
                  : []),
              ]}
            />
            <DropdownMenu
              label="更多"
              icon={<MoreHorizontal size={15} />}
              items={[
                {
                  label: '增量导入台账 ZIP',
                  hint: '按 ID / SHA-256 合并，不覆盖已有原图',
                  icon: <Upload size={15} />,
                  onClick: () => importRef.current?.click(),
                },
                {
                  label: '管理台账成员',
                  hint: '从已有经历和资料中勾选收录',
                  icon: <Link2 size={15} />,
                  onClick: () => setPickOpen(true),
                },
              ]}
            />
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
          </>
        }
      />

      {isCompetition && (
        <>
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

          {kpi.total > 0 && (
            <div className="grade-bar-card">
              <div className="grade-bar-head">
                <span className="small">湖大分级结构分布</span>
                <span className="muted small tabular">
                  已定级 {kpi.total - kpi.unknownGrade}/{kpi.total}（
                  {Math.round(((kpi.total - kpi.unknownGrade) / kpi.total) * 100)}%）
                </span>
              </div>
              <div className="grade-bar-track">
                {kpi.a1 > 0 && <div className="seg seg-a1" style={{ width: pct(kpi.a1) }} title={`A1: ${kpi.a1}`} />}
                {kpi.a2 > 0 && <div className="seg seg-a2" style={{ width: pct(kpi.a2) }} title={`A2: ${kpi.a2}`} />}
                {kpi.bClass > 0 && (
                  <div className="seg seg-b" style={{ width: pct(kpi.bClass) }} title={`B1/B2: ${kpi.bClass}`} />
                )}
                {kpi.unknownGrade > 0 && (
                  <div className="seg seg-u" style={{ width: pct(kpi.unknownGrade) }} title={`待确认: ${kpi.unknownGrade}`} />
                )}
              </div>
              <div className="grade-bar-legend">
                <button type="button" onClick={() => setGradeFilter(gradeFilter === 'A1' ? 'all' : 'A1')}>
                  <i className="dot seg-a1" /> A1 ({kpi.a1})
                </button>
                <button type="button" onClick={() => setGradeFilter(gradeFilter === 'A2' ? 'all' : 'A2')}>
                  <i className="dot seg-a2" /> A2 ({kpi.a2})
                </button>
                <button type="button" onClick={() => setGradeFilter(gradeFilter === 'B1' ? 'all' : 'B1')}>
                  <i className="dot seg-b" /> B1/B2 ({kpi.bClass})
                </button>
                <button type="button" onClick={() => setGradeFilter(gradeFilter === '待确认' ? 'all' : '待确认')}>
                  <i className="dot seg-u" /> 待确认 ({kpi.unknownGrade})
                </button>
              </div>
            </div>
          )}
        </>
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
          <div className="muted small tabular">
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
                placeholder="搜索名称、奖项、机构、技术栈或备注…"
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
              {(query ||
                auditFilter !== 'all' ||
                groupFilter !== 'all' ||
                gradeFilter !== 'all' ||
                yearFilter !== 'all') && (
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
                    <th>名称</th>
                    {isCompetition && <th style={{ width: 106 }}>湖大分级</th>}
                    {isCompetition && <th style={{ width: 185 }}>奖项与成绩</th>}
                    {isCredential && <th style={{ width: 140 }}>类别 / 等级</th>}
                    {isCredential && <th style={{ width: 150 }}>有效期状态</th>}
                    {isProject && <th style={{ width: 180 }}>技术栈与角色</th>}
                    {isProject && <th>量化成果</th>}
                    {!isCompetition && !isCredential && !isProject && <th>地点 / 简介</th>}
                    <th style={{ width: 145 }}>佐证材料</th>
                    <th style={{ width: 108, textAlign: 'right' }}>操作</th>
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
                    const isSelected = drawerExp?.id === e.id;
                    const credBadge = isCredential ? getCredentialBadge(e) : null;

                    return (
                      <tr
                        key={e.id}
                        className={`ledger-row ${isCompetition ? `grade-accent-${gradeTone(grade)}` : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          if (isCompetition) {
                            setDrawerExp(e);
                            setDrawerSlot('证书照片');
                          } else {
                            navigate(`/experiences/${e.id}`, {
                              state: { from: `/collections/${col.id}` },
                            });
                          }
                        }}
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
                            {(getCompField(e, '颁奖单位') || e.customFields?.['发证机构']) && (
                              <span className="muted truncate-inline">
                                {getCompField(e, '颁奖单位') || e.customFields?.['发证机构']}
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
                        {isCredential && (
                          <td>
                            <div className="cell-award">{e.customFields?.['成绩或等级'] || '—'}</div>
                            {e.customFields?.['证件类别'] && (
                              <div className="cell-sub muted">{e.customFields['证件类别']}</div>
                            )}
                          </td>
                        )}
                        {isCredential && credBadge && (
                          <td>
                            <Chip tone={credBadge.tone}>{credBadge.label}</Chip>
                          </td>
                        )}
                        {isProject && (
                          <td>
                            <div className="cell-award">{e.customFields?.['角色'] || '—'}</div>
                            {e.customFields?.['技术栈'] && (
                              <div className="cell-sub muted truncate-inline">
                                {e.customFields['技术栈']}
                              </div>
                            )}
                          </td>
                        )}
                        {isProject && (
                          <td>
                            <span className="muted small">
                              {(e.customFields?.['量化成果'] || e.description || '—').slice(0, 60)}
                            </span>
                          </td>
                        )}
                        {!isCompetition && !isCredential && !isProject && (
                          <td>
                            <span className="muted small">
                              {[e.location, e.description].filter(Boolean).join(' · ').slice(0, 60) || '—'}
                            </span>
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
                              <Chip tone={isCompetition && audit.missingCertificate ? 'danger' : 'neutral'}>
                                {isCompetition && audit.missingCertificate ? '缺证书' : '暂无原件'}
                              </Chip>
                            )}
                            {isCompetition && audit.missingDate && <Chip tone="warn">缺日期</Chip>}
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
                            onClick={() => {
                              if (isCompetition) {
                                setDrawerExp(e);
                                setDrawerSlot('证书照片');
                              } else {
                                navigate(`/experiences/${e.id}`, {
                                  state: { from: `/collections/${col.id}` },
                                });
                              }
                            }}
                          >
                            <UploadCloud size={13} /> {isCompetition ? '快编' : '编辑'}
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
            每一条记录的具体字段保存在单条经历中，点击台账表格任意一行即可快速核验与补充佐证。
          </p>
        </div>
      )}

      {/* 导出 PDF 证明册弹窗 */}
      {pdfOpen && (
        <Modal
          title="生成 PDF 获奖证明汇编"
          subtitle={`将基于当前筛选出的 ${filteredRows.length} 条记录排版封面、汇总目录与证书附页`}
          onClose={() => setPdfOpen(false)}
        >
          <label className="check-row">
            <input
              type="checkbox"
              checked={pdfRedact}
              onChange={(e) => setPdfRedact(e.target.checked)}
            />
            <span>自动应用无损隐私脱敏遮罩（隐藏已框选的身份证/学号/二维码）</span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={pdfIncludeImages}
              onChange={(e) => setPdfIncludeImages(e.target.checked)}
            />
            <span>在汇总表后逐页附带高清佐证原图</span>
          </label>
          <p className="hint-box">
            点击生成后会打开排版好的打印预览窗口，在打印机中选择「另存为 PDF」即可获得高清矢量文档。
          </p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setPdfOpen(false)}>
              取消
            </button>
            <button className="btn primary" disabled={pdfBusy} onClick={() => void handleExportPdf()}>
              <Printer size={14} /> {pdfBusy ? '正在排版生成…' : '立即生成证明册'}
            </button>
          </div>
        </Modal>
      )}

      {/* 右侧滑出快编抽屉（支持上一条/下一条连续核验与 Ctrl+S 快捷保存） */}
      {drawerExp && (() => {
        const curIdx = filteredRows.findIndex((r) => r.id === drawerExp.id);
        const prevRow = curIdx > 0 ? filteredRows[curIdx - 1] : null;
        const nextRow = curIdx >= 0 && curIdx < filteredRows.length - 1 ? filteredRows[curIdx + 1] : null;
        return (
        <div
          className="drawer-backdrop"
          onMouseDown={() => setDrawerExp(null)}
          onKeyDown={(ev) => {
            if (ev.key === 'Escape') setDrawerExp(null);
            if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
              ev.preventDefault();
              void saveDrawerExp();
            }
          }}
        >
          <aside className="drawer-panel" onMouseDown={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div style={{ minWidth: 0 }}>
                <div className="row-gap" style={{ marginBottom: 4 }}>
                  <Chip tone={gradeTone(getCompField(drawerExp, '湖大分级'))}>
                    {getCompField(drawerExp, '湖大分级') || '分级待确认'}
                  </Chip>
                  <span className="muted small tabular">{drawerExp.startAt ?? '时间待确认'}</span>
                  {curIdx >= 0 && (
                    <span className="muted small tabular">
                      · {curIdx + 1}/{filteredRows.length}
                    </span>
                  )}
                </div>
                <h2 className="drawer-title">{drawerExp.title}</h2>
              </div>
              <div className="drawer-nav">
                <button
                  type="button"
                  className="icon-btn"
                  disabled={!prevRow}
                  title="上一条"
                  onClick={() => prevRow && setDrawerExp(prevRow)}
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={!nextRow}
                  title="下一条"
                  onClick={() => nextRow && setDrawerExp(nextRow)}
                >
                  <ChevronRight size={17} />
                </button>
                <button className="icon-btn" onClick={() => setDrawerExp(null)} aria-label="关闭抽屉">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="drawer-body">
              <Field label="竞赛名称">
                <input
                  value={drawerExp.title}
                  onChange={(e) => setDrawerExp({ ...drawerExp, title: e.target.value })}
                />
              </Field>

              <div className="two-col">
                <Field label="发生时间">
                  <input
                    placeholder="2026-05-24"
                    value={drawerExp.startAt ?? ''}
                    onChange={(e) =>
                      setDrawerExp({
                        ...drawerExp,
                        startAt: e.target.value || undefined,
                        timePrecision: e.target.value
                          ? e.target.value.length === 4
                            ? 'year'
                            : e.target.value.length === 7
                              ? 'month'
                              : 'day'
                          : 'unknown',
                      })
                    }
                  />
                </Field>
                <Field label="是否获奖">
                  <select
                    value={getCompField(drawerExp, '是否获奖')}
                    onChange={(e) =>
                      setDrawerExp({
                        ...drawerExp,
                        customFields: setCompField(drawerExp, '是否获奖', e.target.value),
                      })
                    }
                  >
                    <option value="">待核实</option>
                    <option value="是">是</option>
                    <option value="否">否</option>
                  </select>
                </Field>
              </div>

              <Field label="湖大分级（点击快选）">
                <div className="filters">
                  {(['A1', 'A2', 'B1', 'B2', 'C', '待确认'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`filter-btn ${getGradeBucket(getCompField(drawerExp, '湖大分级')) === g ? 'active' : ''}`}
                      onClick={() =>
                        setDrawerExp({
                          ...drawerExp,
                          customFields: setCompField(drawerExp, '湖大分级', g),
                        })
                      }
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="two-col">
                <Field label="奖项">
                  <input
                    placeholder="一等奖 / 银奖"
                    value={getCompField(drawerExp, '奖项')}
                    onChange={(e) =>
                      setDrawerExp({
                        ...drawerExp,
                        customFields: setCompField(drawerExp, '奖项', e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="成绩 / 排名">
                  <input
                    placeholder="例如：1/279"
                    value={getCompField(drawerExp, '排名') || getCompField(drawerExp, '成绩')}
                    onChange={(e) =>
                      setDrawerExp({
                        ...drawerExp,
                        customFields: setCompField(drawerExp, '排名', e.target.value),
                      })
                    }
                  />
                </Field>
              </div>

              <Field label="颁奖单位">
                <input
                  placeholder="主办或颁奖机构"
                  value={getCompField(drawerExp, '颁奖单位')}
                  onChange={(e) =>
                    setDrawerExp({
                      ...drawerExp,
                      customFields: setCompField(drawerExp, '颁奖单位', e.target.value),
                    })
                  }
                />
              </Field>

              <Field label="备注">
                <textarea
                  rows={2}
                  value={getCompField(drawerExp, '备注')}
                  onChange={(e) =>
                    setDrawerExp({
                      ...drawerExp,
                      customFields: setCompField(drawerExp, '备注', e.target.value),
                    })
                  }
                />
              </Field>

              <div className="drawer-evidence-box">
                <div className="panel-head" style={{ marginBottom: 8 }}>
                  <h3>快速补传佐证 ({drawerExp.captureIds.length})</h3>
                  <div className="filters">
                    {EVIDENCE_SLOTS.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        className={`filter-btn ${drawerSlot === s.key ? 'active' : ''}`}
                        onClick={() => setDrawerSlot(s.key)}
                      >
                        {s.label.replace('照片', '')}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className="dropzone compact-dropzone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files.length) void attachFilesToDrawerExp(e.dataTransfer.files);
                  }}
                  onClick={() => drawerFileRef.current?.click()}
                >
                  <UploadCloud size={20} />
                  <strong>拖入或点击上传到「{drawerSlot}」</strong>
                  <input
                    ref={drawerFileRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    hidden
                    onChange={(e) => {
                      if (e.target.files?.length) void attachFilesToDrawerExp(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </div>

                {drawerExp.captureIds.length > 0 && (
                  <div className="drawer-thumbs">
                    {drawerExp.captureIds
                      .map((cid) => captureMap.get(cid))
                      .filter(Boolean)
                      .map((c) => (
                        <div key={c!.id} className="drawer-thumb-item">
                          <CaptureThumb capture={c!} className="drawer-thumb-img" />
                          <span className="truncate-inline small">{c!.title}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div className="drawer-foot">
              <button
                className="btn"
                onClick={() => {
                  const targetId = drawerExp.id;
                  setDrawerExp(null);
                  navigate(`/experiences/${targetId}`, { state: { from: `/collections/${col.id}` } });
                }}
              >
                <ExternalLink size={14} /> 完整编辑页
              </button>
              <button className="btn primary" onClick={() => void saveDrawerExp()}>
                <Save size={14} /> 保存修改
              </button>
            </div>
          </aside>
        </div>
        );
      })()}

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
