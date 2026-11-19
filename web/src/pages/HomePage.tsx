import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

export function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <main>
      <h1>Epiquiz</h1>
      <p>Bonjour {user?.displayName}.</p>
      <button type="button" onClick={onLogout}>
        Se déconnecter
      </button>
    </main>
  );
}
