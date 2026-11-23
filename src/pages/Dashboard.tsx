import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Image as ImageIcon,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { db } from '../db';
import type { Capture, Collection, Experience } from '../types';
import {
  auditCompetition,
  getCompField,
  gradeTone,
  isAwarded,
  isCompetitionExperience,
  mergeEvidenceText,
  setCompField,
} from '../lib/competition';
import {
  auditCredentialExpiries,
  buildMatchSuggestions,
  type MatchSuggestion,
} from '../lib/intelligence';
import { now, recordHistory } from '../lib/utils';
import { Chip, PageHead, StatCard, useToast } from '../components/common';
import { LanDropModal } from '../components/LanDropModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();

  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [lanOpen, setLanOpen] = useState(false);

  const reload = () =>
    void Promise.all([
      db.experiences.toArray(),
      db.captures.orderBy('importedAt').reverse().toArray(),
      db.collections.toArray(),
    ]).then(([e, c, cols]) => {
      setExperiences(e);
      setCaptures(c);
      setCollections(cols);
    });

  useEffect(() => {
    reload();
  }, []);

  const compCollection = useMemo(
    () => collections.find((c) => c.templateId === 'tpl-competition') ?? null,
    [collections],
  );

  const compExps = useMemo(() => experiences.filter(isCompetitionExperience), [experiences]);
  const awardedCount = useMemo(() => compExps.filter(isAwarded).length, [compExps]);
  const missingCertExps = useMemo(
    () => compExps.filter((e) => auditCompetition(e).missingCertificate),
    [compExps],
  );

  // 按年份分布统计
  const yearBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of experiences) {
      const y = e.startAt && /^\d{4}/.test(e.startAt) ? e.startAt.slice(0, 4) : '待确认';
      map.set(y, (map.get(y) ?? 0) + 1);
    }
    const entries = Array.from(map.entries()).sort((a, b) => {
      if (a[0] === '待确认') return 1;
      if (b[0] === '待确认') return -1;
      return a[0].localeCompare(b[0]);
    });
    const max = Math.max(1, ...entries.map((x) => x[1]));
    return entries.map(([year, count]) => ({ year, count, pct: Math.round((count / max) * 100) }));
  }, [experiences]);

  const suggestions = useMemo(
    () => buildMatchSuggestions(captures, experiences, 6),
    [captures, experiences],
  );

  const credentialExpiries = useMemo(() => auditCredentialExpiries(experiences), [experiences]);
  // 只把临期（90 天内）与已过期的挑出来做提醒，其余证件仍可查看但不占用提醒位
  const expiringSoon = useMemo(
    () => credentialExpiries.filter((x) => x.state !== 'valid'),
    [credentialExpiries],
  );

  const acceptSuggestion = async (s: MatchSuggestion) => {
    const exp = await db.experiences.get(s.experience.id);
    if (!exp) return;
    await recordHistory('experience', exp.id, exp);

    const prevSlots = exp.evidenceSlots ?? {};
    const nextSlotIds = Array.from(new Set([...(prevSlots[s.suggestedSlot] ?? []), s.capture.id]));
    const nextCapIds = Array.from(new Set([...exp.captureIds, s.capture.id]));
    let nextCf = setCompField(
      exp,
      s.suggestedSlot,
      mergeEvidenceText(getCompField(exp, s.suggestedSlot), [s.capture.title]),
    );
    if (s.suggestedAward) nextCf = setCompField({ ...exp, customFields: nextCf }, '奖项', s.suggestedAward);

    await db.experiences.put({
      ...exp,
      startAt: exp.startAt ?? s.suggestedDate,
      timePrecision:
        exp.startAt || !s.suggestedDate
          ? exp.timePrecision
          : s.suggestedDate.length === 7
            ? 'month'
            : 'day',
      captureIds: nextCapIds,
      evidenceSlots: { ...prevSlots, [s.suggestedSlot]: nextSlotIds },
      customFields: nextCf,
      updatedAt: now(),
    });
    toast(`已采纳建议：挂载到「${exp.title}」的${s.suggestedSlot}`);
    reload();
  };

  return (
    <div className="page page-wide">
      <PageHead
        title="档案总览"
        subtitle="一眼掌握你的经历脉搏、待补齐佐证、智能归属建议与证件有效期"
        actions={
          <>
            <button className="btn primary" onClick={() => setLanOpen(true)}>
              <Smartphone size={15} /> 手机扫码传图
            </button>
            {compCollection && (
              <button className="btn" onClick={() => navigate(`/collections/${compCollection.id}`)}>
                <Trophy size={15} /> 进入竞赛总台账
              </button>
            )}
          </>
        }
      />

      <div className="kpi-strip">
        <StatCard
          label="沉淀经历"
          value={experiences.length}
          sub={`分布在 ${collections.length} 个台账`}
          tone="neutral"
          onClick={() => navigate('/experiences')}
        />
        <StatCard
          label="竞赛获奖"
          value={awardedCount}
          sub={`竞赛记录共 ${compExps.length} 条`}
          tone="gold"
          onClick={() =>
            navigate(compCollection ? `/collections/${compCollection.id}` : '/collections')
          }
        />
        <StatCard
          label="原件素材库"
          value={captures.length}
          sub="SHA-256 自动去重"
          tone="accent"
          onClick={() => navigate('/')}
        />
        <StatCard
          label="待补齐证书"
          value={missingCertExps.length}
          sub={`智能建议 ${suggestions.length} 条`}
          tone={missingCertExps.length > 0 ? 'warn' : 'emerald'}
          onClick={() =>
            navigate(compCollection ? `/collections/${compCollection.id}` : '/collections')
          }
        />
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>年度经历分布</h3>
            <span className="muted small">按记录开始年份统计</span>
          </div>
          {yearBars.length === 0 ? (
            <p className="muted small">导入台账或新增经历后，这里会呈现你的成长时间分布。</p>
          ) : (
            <div className="year-chart">
              {yearBars.map((b) => (
                <div key={b.year} className="year-col">
                  <span className="year-count tabular">{b.count}</span>
                  <div className="year-bar-wrap">
                    <div
                      className={`year-bar ${b.year === '待确认' ? 'is-muted' : ''}`}
                      style={{ height: `${Math.max(10, b.pct)}%` }}
                    />
                  </div>
                  <span className="year-label tabular">{b.year}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>智能归属建议</h3>
            <Chip tone="accent">仅提建议 · 需你确认</Chip>
          </div>
          {suggestions.length === 0 ? (
            <p className="muted small">
              当前没有待确认的自动匹配建议。往收件箱拖入证书照片或用「本地 OCR」识别后，系统会自动在这里推荐最可能对应的竞赛。
            </p>
          ) : (
            <div className="suggest-list">
              {suggestions.map((s) => (
                <div key={`${s.capture.id}-${s.experience.id}`} className="suggest-item">
                  <div className="suggest-copy">
                    <div className="suggest-title">
                      <ImageIcon size={14} className="muted" />
                      <strong>{s.capture.title}</strong>
                      <ArrowRight size={13} className="muted" />
                      <span>{s.experience.title}</span>
                    </div>
                    <div className="row-gap" style={{ marginTop: 5 }}>
                      <Chip tone="emerald">槽位：{s.suggestedSlot}</Chip>
                      {s.reasons.map((r) => (
                        <span key={r} className="muted small">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button className="btn small primary" onClick={() => void acceptSuggestion(s)}>
                    <Check size={13} /> 确认关联
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>待补齐证书（优先核验）</h3>
            {compCollection && (
              <button
                className="btn small ghost"
                onClick={() => navigate(`/collections/${compCollection.id}`)}
              >
                查看全部 <ArrowRight size={13} />
              </button>
            )}
          </div>
          {missingCertExps.length === 0 ? (
            <p className="muted small">所有已获奖项均已挂好证书或佐证线索。</p>
          ) : (
            <div className="mini-list">
              {missingCertExps.slice(0, 6).map((e) => (
                <button
                  key={e.id}
                  className="mini-row"
                  onClick={() => navigate(`/experiences/${e.id}`, { state: { from: '/dashboard' } })}
                >
                  <div className="mini-row-main">
                    <strong>{e.title}</strong>
                    <span className="muted small">
                      {[e.startAt ?? '时间待确认', getCompField(e, '奖项')].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <Chip tone={gradeTone(getCompField(e, '湖大分级'))}>
                    {getCompField(e, '湖大分级') || '待确认'}
                  </Chip>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>证件与资质有效期提醒</h3>
            <ShieldCheck size={16} className="muted" />
          </div>
          {credentialExpiries.length === 0 ? (
            <div className="dash-cred-empty">
              <Sparkles size={18} className="muted" />
              <p className="muted small">
                在「台账与模板」里用「证件与资质」模板录入四六级、软考、驾照或护照并填写「有效期至」，到期前 90 天会在这里自动提醒。
              </p>
            </div>
          ) : (
            <div className="mini-list">
              {(expiringSoon.length > 0 ? expiringSoon : credentialExpiries).slice(0, 6).map((item) => (
                <button
                  key={item.experience.id}
                  className="mini-row"
                  onClick={() =>
                    navigate(`/experiences/${item.experience.id}`, {
                      state: { from: '/dashboard' },
                    })
                  }
                >
                  <div className="mini-row-main">
                    <strong>{item.experience.title}</strong>
                    <span className="muted small tabular">有效期至 {item.expiryDate}</span>
                  </div>
                  <Chip
                    tone={
                      item.state === 'expired'
                        ? 'danger'
                        : item.state === 'soon'
                          ? 'warn'
                          : 'emerald'
                    }
                  >
                    {item.state === 'expired' ? (
                      <>
                        <AlertTriangle size={11} style={{ marginRight: 3 }} />
                        已过期 {Math.abs(item.daysLeft)} 天
                      </>
                    ) : (
                      `剩余 ${item.daysLeft} 天`
                    )}
                  </Chip>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {lanOpen && <LanDropModal onClose={() => setLanOpen(false)} onReceived={reload} />}
    </div>
  );
}
