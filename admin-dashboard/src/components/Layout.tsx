import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useTheme } from '../store/theme';

const NAV = [
  { to: '/', label: 'Overview', icon: '⊞', end: true },
  { to: '/hospitals', label: 'Hospitals', icon: '🏥' },
  { to: '/map', label: 'Patient Map', icon: '🗺️' },
  { to: '/feedback', label: 'Feedback', icon: '✎' },
  { to: '/audit', label: 'Audit Log', icon: '📋' },
  { to: '/users', label: 'Users & Roles', icon: '👥' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();

  const current = NAV.find((n) => n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to) && n.to !== '/');
  const title = current?.label || 'Hospital Mitra';

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="logo">✚</div>
          <div>
            <div className="name">Hospital Mitra</div>
            <div className="sub">Admin Console</div>
          </div>
        </div>
        <div className="nav-section">Workspace</div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setOpen(false)}>
            <span className="ic">{n.icon}</span>{n.label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{user?.display_name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{user?.role}</div>
            </div>
            <button className="btn btn-sm" onClick={() => { logout(); nav('/login'); }}>Sign out</button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen((o) => !o)}>☰</button>
          <div>
            <h1>{title}</h1>
            <div className="crumb">{user?.hospital_id ? 'Hospital scope' : 'Platform-wide'} · {user?.email}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-sm" onClick={toggle} title="Toggle theme">{theme === 'light' ? '🌙' : '☀️'}</button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
