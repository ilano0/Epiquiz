import { useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { useAuth } from "../features/auth/AuthContext";

export function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Logo />
        <button type="button" className="pill-link" onClick={onLogout}>
          Se déconnecter
        </button>
      </header>
      <main className="page">
        <h1 className="brand">
          Epi<span>Quiz</span>
        </h1>
        <p className="tagline">Bonjour {user?.displayName}.</p>
      </main>
    </div>
  );
}
