import { FormEvent, useEffect, useState } from "react";
import { TaskTemplatesPage } from "./TaskTemplates";
import { TasksPage } from "./Tasks";
import { WorkflowsPage } from "./Workflows";
import { AdminPage } from "./Admin";

const navigation = [
  ["⌂", "Dashboard"], ["◈", "Organizations"], ["○", "Users"], ["▦", "Task Templates"], ["✓", "Tasks"], ["↗", "Workflows"],
  ["◌", "Communications"], ["⊙", "Lead Engine"], ["◆", "Services"], ["$", "Transactions"],
] as const;

type AuthUser = { id: string; firstName: string; lastName: string; email: string; roles: string[]; permissions: string[] };
const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000/api";

function LoginPage({ onLogin }: { onLogin: (user: AuthUser, token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setLoading(true); setError(""); try { const response = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }); if (!response.ok) throw new Error("Invalid email or password."); const result = await response.json(); localStorage.setItem("nexus_token", result.token); onLogin(result.user, result.token); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to sign in."); } finally { setLoading(false); } };
  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={submit}>
        <div className="brand-mark">N</div>
        <p className="eyebrow">NEXUS WORKSPACE</p>
        <h1>Welcome back.</h1>
        <p className="login-copy">Your connected workspace for customer operations.</p>
        {error && <div className="error-banner">{error}</div>}
        <label className="login-field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label className="login-field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <button className="primary-button" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"} <span>→</span></button>
        <p className="placeholder-note">Use a local development account configured by the project seed.</p>
      </form>
      <aside className="login-aside"><span>01</span><p>One clear place<br />to move work forward.</p></aside>
    </main>
  );
}

export function App() {
  const initialPage = window.location.pathname.startsWith("/task-templates") ? "Task Templates" : window.location.pathname.startsWith("/tasks") ? "Tasks" : window.location.pathname.startsWith("/workflows") ? "Workflows" : window.location.pathname.startsWith("/admin") ? "Admin" : "Dashboard";
  const [activePage, setActivePage] = useState(initialPage);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(localStorage.getItem("nexus_token")));
  const [showUserMenu, setShowUserMenu] = useState(false);
  useEffect(() => { const expire = () => { localStorage.removeItem("nexus_token"); setAuthUser(null); setActivePage("Dashboard"); }; window.addEventListener("nexus-session-expired", expire); const token = localStorage.getItem("nexus_token"); if (!token) { setAuthLoading(false); return () => window.removeEventListener("nexus-session-expired", expire); } fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(async (response) => { if (!response.ok) throw new Error("Session expired."); const result = await response.json(); setAuthUser(result.user); }).catch(expire).finally(() => setAuthLoading(false)); return () => window.removeEventListener("nexus-session-expired", expire); }, []);

  if (authLoading) return <main className="login-page"><section className="login-panel"><div className="brand-mark">N</div><p className="eyebrow">NEXUS WORKSPACE</p><h1>Loading workspace.</h1></section></main>;
  if (!authUser) return <LoginPage onLogin={(user) => { setAuthUser(user); window.history.pushState({}, "", "/"); }} />;

  const openPage = (page: string) => {
    setActivePage(page);
    if (page === "Task Templates") window.history.pushState({}, "", "/task-templates");
    if (page === "Tasks") window.history.pushState({}, "", "/tasks");
    if (page === "Workflows") window.history.pushState({}, "", "/workflows");
    if (page === "Admin") window.history.pushState({}, "", "/admin");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-mark small">N</div><span>NEXUS</span></div>
        <div className="workspace-switcher"><span className="workspace-dot" /> Acme workspace <span className="chevron">⌄</span></div>
        <nav aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {navigation.map(([icon, label]) => <button className={`nav-item ${activePage === label ? "active" : ""}`} key={label} onClick={() => openPage(label)}><span className="nav-icon">{icon}</span>{label}</button>)}
          {authUser.permissions.includes("organizations.read") && <button className={`nav-item ${activePage === "Admin" ? "active" : ""}`} onClick={() => openPage("Admin")}><span className="nav-icon">◆</span>Admin</button>}
          <p className="nav-label secondary">Manage</p>
          <button className="nav-item" onClick={() => setActivePage("Settings")}><span className="nav-icon">⚙</span>Settings</button>
        </nav>
        <div className="sidebar-bottom"><div className="upgrade-note"><span className="spark">✦</span><strong>Make space for<br />better work.</strong><span className="arrow">↗</span></div><button className="help-link">? <span>Help center</span></button></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{activePage}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Search">⌕</button><button className="icon-button notification" aria-label="Notifications">♢<i /></button><div className="profile-wrap"><button className="profile-button" onClick={() => setShowUserMenu(!showUserMenu)}><span className="avatar">{authUser.firstName[0]}{authUser.lastName[0]}</span><span className="profile-name">{authUser.firstName} {authUser.lastName}</span><span className="chevron">⌄</span></button>{showUserMenu && <div className="profile-menu"><strong>{authUser.firstName} {authUser.lastName}</strong><span>{authUser.roles.join(", ")}</span><button onClick={async () => { await fetch(`${API}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("nexus_token") || ""}` } }); localStorage.removeItem("nexus_token"); setAuthUser(null); setShowUserMenu(false); window.history.pushState({}, "", "/login"); }}>Sign out</button></div>}</div></div></header>
        {activePage === "Admin" ? authUser.permissions.includes("organizations.read") ? <AdminPage onNavigate={openPage} /> : <section className="content"><div className="error-banner"><strong>403</strong> You don't have permission to access this area.</div></section> : activePage === "Task Templates" ? <TaskTemplatesPage onBack={() => { setActivePage("Dashboard"); window.history.pushState({}, "", "/"); }} /> : activePage === "Tasks" ? <TasksPage /> : activePage === "Workflows" ? <WorkflowsPage /> : <section className="content"><div className="content-heading"><div><p className="eyebrow">TUESDAY, SEPTEMBER 8, 2026</p><h1>Good morning, {authUser.firstName}.</h1><p className="muted">Here is what is happening across your workspace.</p></div><button className="outline-button">+ <span>New activity</span></button></div>
          <div className="signal-strip"><div className="signal-icon">✦</div><div><strong>Your workspace is ready.</strong><p>Choose a section from the sidebar to begin shaping your customer operations.</p></div><span className="signal-status">Foundation mode</span></div>
          <div className="overview-grid"><div className="overview-card wide"><div className="card-header"><div><p className="card-kicker">WORKSPACE OVERVIEW</p><h2>A calm place to get oriented.</h2></div><span className="card-mark">N</span></div><div className="empty-state"><span className="empty-line" /><p>Activity will appear here<br />as your workspace takes shape.</p></div></div><div className="overview-card"><p className="card-kicker">QUICK ACCESS</p><div className="quick-links"><button onClick={() => setActivePage("Organizations")}><span>◈</span>Organizations <b>→</b></button><button onClick={() => setActivePage("Tasks")}><span>✓</span>Tasks <b>→</b></button><button onClick={() => setActivePage("Workflows")}><span>↗</span>Workflows <b>→</b></button></div></div></div>
        </section>}
        <footer className="footer"><span>NEXUS foundation · v0.1.0</span><span>All systems nominal <i className="status-dot" /></span></footer>
      </main>
    </div>
  );
}