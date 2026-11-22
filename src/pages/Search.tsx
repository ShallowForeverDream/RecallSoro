import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, LayoutGrid, Search as SearchIcon, Sparkles } from 'lucide-react';
import { db } from '../db';
import type { Capture, Collection, Experience } from '../types';
import { Chip, Empty, PageHead } from '../components/common';

type Result = {
  id: string;
  type: 'capture' | 'experience' | 'collection';
  title: string;
  desc: string;
  to: string;
  match: string;
};

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [data, setData] = useState<{ captures: Capture[]; experiences: Experience[]; collections: Collection[] }>({
    captures: [], experiences: [], collections: [],
  });

  useEffect(() => {
    void Promise.all([db.captures.toArray(), db.experiences.toArray(), db.collections.toArray()]).then(([c, e, col]) => {
      setData({ captures: c, experiences: e, collections: col });
    });
  }, []);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Result[] = [];
    for (const c of data.captures) {
      const hay = [c.title, c.originalName, c.note, c.text ?? '', c.url ?? '', ...c.tags, ...c.facts.map((f) => f.value)].join(' ');
      if (hay.toLowerCase().includes(q)) {
        out.push({ id: c.id, type: 'capture', title: c.title, desc: c.note || c.originalName, to: '/', match: hay.slice(0, 160) });
      }
    }
    for (const e of data.experiences) {
      const hay = [e.title, e.description, e.location, ...e.tags].join(' ');
      if (hay.toLowerCase().includes(q)) {
        out.push({ id: e.id, type: 'experience', title: e.title, desc: e.description, to: `/experiences/${e.id}`, match: hay.slice(0, 160) });
      }
    }
    for (const c of data.collections) {
      const hay = [c.title, c.description, ...Object.values(c.fieldValues)].join(' ');
      if (hay.toLowerCase().includes(q)) {
        out.push({ id: c.id, type: 'collection', title: c.title, desc: c.description, to: `/collections/${c.id}`, match: hay.slice(0, 160) });
      }
    }
    return out;
  }, [query, data]);

  return (
    <div className="page">
      <PageHead title="搜索" subtitle="同时搜索标题、描述、备注、OCR 文字、地点和标签" />
      <div className="search-hero">
        <SearchIcon size={22} />
        <input autoFocus placeholder="输入关键词、地点、年份或标签…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {!query.trim() ? (
        <Empty icon={<SearchIcon size={34} />} title="想找什么？" desc="输入一个词， RecallSoro 会在全部经历和资料中查找。" />
      ) : results.length === 0 ? (
        <Empty icon={<SearchIcon size={34} />} title="没有找到结果" desc="换个词试试，或者检查标签是否写对。" />
      ) : (
        <>
          <p className="muted">找到 {results.length} 条结果</p>
          <div className="card-list">
            {results.map((r) => {
              const Icon = r.type === 'capture' ? FileText : r.type === 'experience' ? Sparkles : LayoutGrid;
              return (
                <button key={`${r.type}-${r.id}`} className="list-card" onClick={() => navigate(r.to)}>
                  <div className="list-card-icon"><Icon size={20} /></div>
                  <div className="list-card-main">
                    <div className="list-card-title">{r.title}</div>
                    <p>{r.desc || r.match}</p>
                    <div className="row-gap"><Chip tone="accent">{r.type === 'capture' ? '资料' : r.type === 'experience' ? '经历' : '集合'}</Chip></div>
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
