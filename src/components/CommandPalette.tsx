import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Moon,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  Sun,
  Trophy,
} from 'lucide-react';
import { db } from '../db';
import type { Collection, Experience } from '../types';
import { getCompField, isCompetitionExperience } from '../lib/competition';
import { Chip } from './common';

interface CommandItem {
  id: string;
  group: '快捷操作' | '导航' | '台账与经历';
  title: string;
  subtitle?: string;
  badge?: string;
  icon: typeof Search;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  onOpenLanDrop,
  theme,
  onToggleTheme,
}: {
  open: boolean;
  onClose: () => void;
  onOpenLanDrop: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 20);
    void Promise.all([db.experiences.toArray(), db.collections.toArray()]).then(([e, c]) => {
      setExperiences(e);
      setCollections(c);
    });
  }, [open]);

  const items = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase();
    const all: CommandItem[] = [
      {
        id: 'act-lan',
        group: '快捷操作',
        title: '打开手机扫码传图',
        subtitle: '同一 Wi-Fi 扫码把证书与合照直传电脑收件箱',
        icon: Smartphone,
        run: () => {
          onClose();
          onOpenLanDrop();
        },
      },
      {
        id: 'act-theme',
        group: '快捷操作',
        title: theme === 'dark' ? '切换到浅色暖纸主题' : '切换到深色护眼主题',
        subtitle: '即时切换全局界面配色',
        icon: theme === 'dark' ? Sun : Moon,
        run: () => {
          onToggleTheme();
          onClose();
        },
      },
      {
        id: 'nav-dashboard',
        group: '导航',
        title: '档案总览',
        subtitle: '年度分布、智能归属建议、待补齐证书与证件提醒',
        icon: LayoutDashboard,
        run: () => {
          navigate('/dashboard');
          onClose();
        },
      },
      {
        id: 'nav-inbox',
        group: '导航',
        title: '统一收件箱',
        subtitle: '拖入文件、快速记录、批量整理',
        icon: Inbox,
        run: () => {
          navigate('/');
          onClose();
        },
      },
      {
        id: 'nav-collections',
        group: '导航',
        title: '台账与模板',
        subtitle: '查看全部竞赛、项目、证件台账与导出',
        icon: LayoutGrid,
        run: () => {
          navigate('/collections');
          onClose();
        },
      },
      {
        id: 'nav-timeline',
        group: '导航',
        title: '个人时间轴',
        icon: CalendarDays,
        run: () => {
          navigate('/timeline');
          onClose();
        },
      },
      {
        id: 'nav-settings',
        group: '导航',
        title: '设置与备份',
        icon: Settings,
        run: () => {
          navigate('/settings');
          onClose();
        },
      },
    ];

    for (const c of collections) {
      all.push({
        id: `col-${c.id}`,
        group: '台账与经历',
        title: c.title,
        subtitle: `${c.experienceIds.length} 条记录`,
        badge: '台账',
        icon: c.templateId === 'tpl-competition' ? Trophy : LayoutGrid,
        run: () => {
          navigate(`/collections/${c.id}`);
          onClose();
        },
      });
    }

    for (const e of experiences) {
      const isComp = isCompetitionExperience(e);
      const grade = isComp ? getCompField(e, '湖大分级') : '';
      const award = isComp ? getCompField(e, '奖项') : '';
      all.push({
        id: `exp-${e.id}`,
        group: '台账与经历',
        title: e.title,
        subtitle: [e.startAt ?? '时间待确认', award, getCompField(e, '颁奖单位')]
          .filter(Boolean)
          .join(' · '),
        badge: grade || (isComp ? '竞赛' : '经历'),
        icon: isComp ? Trophy : Sparkles,
        run: () => {
          navigate(`/experiences/${e.id}`);
          onClose();
        },
      });
    }

    if (!q) return all.slice(0, 14);
    return all
      .filter((it) => `${it.title} ${it.subtitle ?? ''} ${it.badge ?? ''}`.toLowerCase().includes(q))
      .slice(0, 20);
  }, [query, collections, experiences, navigate, onClose, onOpenLanDrop, onToggleTheme, theme]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  return (
    <div className="cmd-backdrop" onMouseDown={onClose}>
      <div
        className="cmd-dialog"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && items[activeIndex]) {
            e.preventDefault();
            items[activeIndex].run();
          }
        }}
      >
        <div className="cmd-input-row">
          <Search size={17} className="muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索竞赛、奖项、页面或快捷命令…"
          />
          <kbd className="kbd">ESC</kbd>
        </div>

        <div className="cmd-list">
          {items.length === 0 ? (
            <div className="cmd-empty">没有找到匹配项</div>
          ) : (
            items.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`cmd-item ${idx === activeIndex ? 'active' : ''}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={item.run}
                >
                  <div className="cmd-item-icon">
                    <Icon size={15} />
                  </div>
                  <div className="cmd-item-copy">
                    <div className="cmd-item-title">{item.title}</div>
                    {item.subtitle && <div className="cmd-item-sub">{item.subtitle}</div>}
                  </div>
                  {item.badge && <Chip tone="accent">{item.badge}</Chip>}
                </button>
              );
            })
          )}
        </div>

        <div className="cmd-foot">
          <span>↑↓ 选择</span>
          <span>↵ 打开</span>
          <span>Ctrl / ⌘ + K 随时呼出</span>
        </div>
      </div>
    </div>
  );
}
