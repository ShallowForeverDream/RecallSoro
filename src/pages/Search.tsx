import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, LayoutGrid, Search as SearchIcon, Sparkles, Trophy } from 'lucide-react';
import { db } from '../db';
import type { Capture, Collection, Experience } from '../types';
import { getCompField, gradeTone, isCompetitionExperience } from '../lib/competition';
import { Chip, Empty, PageHead } from '../components/common';

type Result = {
  id: string;
  type: 'capture' | 'experience' | 'collection';
  isComp?: boolean;
  grade?: string;
  title: string;
  desc: string;
  to: string;
  match: string;
};

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [data, setData] = useState<{
    captures: Capture[];
    experiences: Experience[];
    collections: Collection[];
  }>({
    captures: [],
    experiences: [],
    collections: [],
  });

  useEffect(() => {
    void Promise.all([
      db.captures.toArray(),
      db.experiences.toArray(),
      db.collections.toArray(),
    ]).then(([c, e, col]) => {
      setData({ captures: c, experiences: e, collections: col });
    });
  }, []);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Result[] = [];
    for (const e of data.experiences) {
      const cfValues = Object.values(e.customFields ?? {});
      const hay = [e.title, e.description, e.location, e.startAt ?? '', ...e.tags, ...cfValues].join(' ');
      // 同 Capture：台账里的赛事名可能与 OCR 文本一样带空格，去空格后再比一次
      const flat = hay.replace(/\s+/g, '');
      const flatQuery = q.replace(/\s+/g, '');
      if (
        hay.toLowerCase().includes(q) ||
        (flatQuery.length >= 2 && flat.toLowerCase().includes(flatQuery))
      ) {
        const isComp = isCompetitionExperience(e);
        const grade = isComp ? getCompField(e, '湖大分级') : '';
        const award = isComp ? getCompField(e, '奖项') : '';
        out.push({
          id: e.id,
          type: 'experience',
          isComp,
          grade,
          title: e.title,
          desc: [e.startAt, award, e.description].filter(Boolean).join(' · '),
          to: `/experiences/${e.id}`,
          match: hay.slice(0, 160),
        });
      }
    }
    for (const c of data.captures) {
      const hay = [
        c.title,
        c.originalName,
        c.note,
        c.text ?? '',
        c.url ?? '',
        c.ocrText ?? '',
        ...c.tags,
        ...c.facts.map((f) => f.value),
      ].join(' ');
      // OCR 文本里中文被逐字空格分隔（「蓝 桥 杯」），子串匹配搜不到「蓝桥杯」。
      // 这里额外用去空格后的版本再比一次。
      const flat = hay.replace(/\s+/g, '');
      const flatQuery = q.replace(/\s+/g, '');
      if (hay.toLowerCase().includes(q) || (flatQuery.length >= 2 && flat.toLowerCase().includes(flatQuery))) {
        out.push({
          id: c.id,
          type: 'capture',
          title: c.title,
          desc: c.note || c.originalName,
          to: '/',
          match: hay.slice(0, 160),
        });
      }
    }
    for (const c of data.collections) {
      const hay = [c.title, c.description, ...Object.values(c.fieldValues)].join(' ');
      if (hay.toLowerCase().includes(q)) {
        out.push({
          id: c.id,
          type: 'collection',
          title: c.title,
          desc: c.description,
          to: `/collections/${c.id}`,
          match: hay.slice(0, 160),
        });
      }
    }
    return out;
  }, [query, data]);

  return (
    <div className="page">
      <PageHead
        title="全局搜索"
        subtitle="同时检索标题、竞赛级别、奖项、颁奖单位、备注、标签和原件文件名"
      />
      <div className="search-hero">
        <SearchIcon size={20} />
        <input
          autoFocus
          placeholder="试试输入：A1、蓝桥杯、一等奖、网安、2025…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!query.trim() ? (
        <Empty
          icon={<SearchIcon size={34} />}
          title="想找哪条经历或证书？"
          desc="输入任意关键词，RecallSoro 会在所有台账字段、经历和收件箱原件中即时查找。"
        />
      ) : results.length === 0 ? (
        <Empty
          icon={<SearchIcon size={34} />}
          title="没有找到匹配结果"
          desc="可以换个简称、年份或奖项关键词试试。"
        />
      ) : (
        <>
          <p className="muted small" style={{ marginBottom: 12 }}>
            找到 <strong>{results.length}</strong> 条相关记录
          </p>
          <div className="card-list">
            {results.map((r) => {
              const Icon =
                r.isComp
                  ? Trophy
                  : r.type === 'capture'
                    ? FileText
                    : r.type === 'experience'
                      ? Sparkles
                      : LayoutGrid;
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  className="list-card"
                  onClick={() => navigate(r.to, { state: { from: '/search' } })}
                >
                  <div className={`list-card-icon ${r.isComp ? 'is-gold' : ''}`}>
                    <Icon size={18} />
                  </div>
                  <div className="list-card-main">
                    <div className="list-card-title">{r.title}</div>
                    <p>{r.desc || r.match}</p>
                    <div className="row-gap">
                      {r.grade && <Chip tone={gradeTone(r.grade)}>{r.grade}</Chip>}
                      <Chip tone="accent">
                        {r.isComp
                          ? '竞赛经历'
                          : r.type === 'capture'
                            ? '原件资料'
                            : r.type === 'experience'
                              ? '经历'
                              : '台账集合'}
                      </Chip>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
