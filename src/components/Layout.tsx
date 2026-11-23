import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  CalendarDays,
  Database,
  Inbox,
  LayoutGrid,
  Search,
  Settings,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { db } from '../db';
import type { Collection } from '../types';

const nav = [
  { to: '/', label: '统一收件箱', icon: Inbox, end: true },
  { to: '/collections', label: '台账与模板', icon: LayoutGrid },
  { to: '/experiences', label: '全部经历', icon: Sparkles },
  { to: '/timeline', label: '时间轴', icon: CalendarDays },
  { to: '/search', label: '全局搜索', icon: Search },
  { to: '/settings', label: '设置与备份', icon: Settings },
];

export default function Layout() {
  const [stats, setStats] = useState({ captures: 0, experiences: 0, collections: 0 });
  const [pinnedComp, setPinnedComp] = useState<Collection | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const [captures, experiences, cols] = await Promise.all([
        db.captures.count(),
        db.experiences.count(),
        db.collections.toArray(),
      ]);
      if (!alive) return;
      setStats({ captures, experiences, collections: cols.length });
      const comp = cols.find((c) => c.templateId === 'tpl-competition') ?? null;
      setPinnedComp(comp);
    };
    void refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div className="brand-copy">
            <div className="brand-name">RecallSoro</div>
            <div className="brand-sub">个人电子经历总台账</div>
          </div>
        </div>

        {pinnedComp && (
          <div className="sidebar-section">
            <div className="sidebar-section-label">常用台账</div>
            <NavLink
              to={`/collections/${pinnedComp.id}`}
              className={({ isActive }) => `nav-item nav-item-pinned ${isActive ? 'active' : ''}`}
            >
              <Trophy size={17} />
              <span className="nav-label">{pinnedComp.title}</span>
              <span className="nav-pill">{pinnedComp.experienceIds.length}</span>
            </NavLink>
          </div>
        )}

        <div className="sidebar-section">
          <div className="sidebar-section-label">工作区</div>
          <nav className="nav">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={17} />
                <span className="nav-label">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-foot">
          <div className="stat-line">
            <Database size={13} />
            <span>本机私有库</span>
          </div>
          <div className="stat-grid">
            <div>
              <strong>{stats.captures}</strong>
              <span>资料</span>
            </div>
            <div>
              <strong>{stats.experiences}</strong>
              <span>经历</span>
            </div>
            <div>
              <strong>{stats.collections}</strong>
              <span>台账</span>
            </div>
          </div>
          <p className="privacy-note">原件本地保存 · 不自动上传云端</p>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
