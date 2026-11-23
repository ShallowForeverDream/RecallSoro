import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  Database,
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
import type { Collection } from '../types';
import { CommandPalette } from './CommandPalette';
import { LanDropModal } from './LanDropModal';

const nav = [
  { to: '/dashboard', label: '档案总览', icon: LayoutDashboard },
  { to: '/', label: '统一收件箱', icon: Inbox, end: true },
  { to: '/collections', label: '台账与模板', icon: LayoutGrid },
  { to: '/experiences', label: '全部经历', icon: Sparkles },
  { to: '/timeline', label: '时间轴', icon: CalendarDays },
  { to: '/settings', label: '设置与备份', icon: Settings },
];

export default function Layout() {
  const location = useLocation();
  const [stats, setStats] = useState({ captures: 0, experiences: 0, collections: 0 });
  const [pinnedComp, setPinnedComp] = useState<Collection | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [lanOpen, setLanOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return localStorage.getItem('recallsoro-theme') === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('recallsoro-theme', theme);
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const refreshStats = useCallback(async () => {
    const [captures, experiences, cols] = await Promise.all([
      db.captures.count(),
      db.experiences.count(),
      db.collections.toArray(),
    ]);
    setStats({ captures, experiences, collections: cols.length });
    setPinnedComp(cols.find((c) => c.templateId === 'tpl-competition') ?? null);
  }, []);

  // 按需刷新（路由切换与窗口聚焦时），零后台空转轮询，保持极低能耗
  useEffect(() => {
    void refreshStats();
  }, [location.pathname, refreshStats]);

  useEffect(() => {
    const onFocus = () => void refreshStats();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshStats]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

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

        <button
          type="button"
          className="cmd-trigger"
          onClick={() => setCmdOpen(true)}
          title="快捷键 Ctrl + K / ⌘ + K"
        >
          <Search size={14} />
          <span className="nav-label">搜索或快速跳转…</span>
          <kbd className="kbd">⌘K</kbd>
        </button>

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

        <button
          type="button"
          className="sidebar-lan-btn"
          onClick={() => setLanOpen(true)}
        >
          <Smartphone size={16} />
          <span className="nav-label">手机扫码传图</span>
        </button>

        <div className="sidebar-foot">
          <div className="sidebar-foot-top">
            <div className="stat-line">
              <Database size={13} />
              <span>本机私有库</span>
            </div>
            <button
              type="button"
              className="icon-btn"
              title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
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

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onOpenLanDrop={() => setLanOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {lanOpen && (
        <LanDropModal
          onClose={() => setLanOpen(false)}
          onReceived={() => void refreshStats()}
        />
      )}
    </div>
  );
}
