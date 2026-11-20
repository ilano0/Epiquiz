import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { useAuth } from "../features/auth/AuthContext";

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-left">
          <Logo />
          <nav aria-label="Navigation principale">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Mes quiz
            </NavLink>
          </nav>
        </div>
        <div className="topbar-right">
          <span className="user-chip">{user?.displayName}</span>
          <button type="button" className="pill-link" onClick={onLogout}>
            Se déconnecter
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
