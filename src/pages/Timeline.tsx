import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, FileText, Sparkles, Trophy } from 'lucide-react';
import { db } from '../db';
import type { Capture, Experience } from '../types';
import { captureSortKey } from '../lib/utils';
import { getCompField, gradeTone, isCompetitionExperience } from '../lib/competition';
import { Chip, Empty, PageHead } from '../components/common';

type Item = {
  id: string;
  type: 'experience' | 'capture';
  date: string;
  title: string;
  subtitle: string;
  exp?: Experience;
  capture?: Capture;
};

export default function Timeline() {
  const navigate = useNavigate();
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [year, setYear] = useState('all');

  useEffect(() => {
    void Promise.all([db.experiences.toArray(), db.captures.toArray()]).then(([e, c]) => {
      setExperiences(e);
      setCaptures(c);
    });
  }, []);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    for (const e of experiences) {
      const date = e.startAt ?? '未定时间';
      const award = getCompField(e, '奖项');
      list.push({
        id: e.id,
        type: 'experience',
        date,
        title: e.title,
        subtitle: [award, e.location, e.description.slice(0, 60)].filter(Boolean).join(' · '),
        exp: e,
      });
    }
    for (const c of captures) {
      list.push({
        id: c.id,
        type: 'capture',
        date: captureSortKey(c),
        title: c.title,
        subtitle: [c.note.slice(0, 60), c.originalName].filter(Boolean).join(' · '),
        capture: c,
      });
    }
    const rank = (d: string) => (/^\d{4}/.test(d) ? 1 : 0);
    return list.sort((a, b) => {
      const ra = rank(a.date);
      const rb = rank(b.date);
      if (ra !== rb) return rb - ra;
      return b.date.localeCompare(a.date);
    });
  }, [experiences, captures]);

  const years = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.date.slice(0, 4))))
        .filter((y) => /^\d{4}$/.test(y))
        .sort()
        .reverse(),
    [items],
  );
  const shown = year === 'all' ? items : items.filter((i) => i.date.startsWith(year));

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of shown) {
      const key = item.date.startsWith('未') ? '时间待确认' : item.date.slice(0, 7);
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [shown]);

  return (
    <div className="page">
      <PageHead
        title="个人时间轴"
        subtitle="按年月回看所有经历与待整理资料，时间未确认项自动排在末尾"
        actions={
          <select value={year} onChange={(e) => setYear(e.target.value)} className="select compact">
            <option value="all">全部年份</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y} 年
              </option>
            ))}
          </select>
        }
      />

      {shown.length === 0 ? (
        <Empty
          icon={<CalendarDays size={34} />}
          title="还没有时间线索"
          desc="先往收件箱放一些资料，或导入一份台账。"
        />
      ) : (
        <div className="timeline">
          {groups.map(([label, group]) => (
            <section key={label} className="timeline-group">
              <div className="timeline-label tabular">{label}</div>
              <div className="timeline-items">
                {group.map((item) => {
                  const isComp = item.exp ? isCompetitionExperience(item.exp) : false;
                  const grade = item.exp && isComp ? getCompField(item.exp, '湖大分级') : '';
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      className={`timeline-item ${item.type}`}
                      onClick={() =>
                        navigate(item.type === 'experience' ? `/experiences/${item.id}` : '/', {
                          state: { from: '/timeline' },
                        })
                      }
                    >
                      <div className={`timeline-dot ${isComp ? 'is-gold' : ''}`}>
                        {isComp ? (
                          <Trophy size={14} />
                        ) : item.type === 'experience' ? (
                          <Sparkles size={14} />
                        ) : (
                          <FileText size={14} />
                        )}
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-title">
                          <span>{item.title}</span>
                          {grade && <Chip tone={gradeTone(grade)}>{grade}</Chip>}
                          <Chip tone={item.type === 'experience' ? 'accent' : 'neutral'}>
                            {isComp ? '竞赛' : item.type === 'experience' ? '经历' : '资料'}
                          </Chip>
                        </div>
                        {item.subtitle && <p>{item.subtitle}</p>}
                      </div>
                      <span className="timeline-date tabular">{item.date}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
