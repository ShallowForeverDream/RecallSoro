import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, Database, Inbox, LayoutGrid, Search, Settings, Sparkles } from 'lucide-react';
import { db } from '../db';

const nav = [
  { to: '/', label: '统一收件箱', icon: Inbox, end: true },
  { to: '/timeline', label: '时间轴', icon: CalendarDays },
  { to: '/experiences', label: '经历', icon: Sparkles },
  { to: '/collections', label: '模板视图', icon: LayoutGrid },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/settings', label: '设置与备份', icon: Settings },
];

export default function Layout() {
  const [stats, setStats] = useState({ captures: 0, experiences: 0, collections: 0 });

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const [captures, experiences, collections] = await Promise.all([
        db.captures.count(), db.experiences.count(), db.collections.count(),
      ]);
      if (alive) setStats({ captures, experiences, collections });
    };
    void refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <div className="brand-name">RecallSoro</div>
            <div className="brand-sub">个人经历总台账</div>
          </div>
        </div>
        <nav className="nav">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="stat-line"><Database size={14} /> 本地存储</div>
          <div className="stat-grid">
            <div><strong>{stats.captures}</strong><span>资料</span></div>
            <div><strong>{stats.experiences}</strong><span>经历</span></div>
            <div><strong>{stats.collections}</strong><span>集合</span></div>
          </div>
          <p className="privacy-note">资料只保存在这台设备上</p>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}
