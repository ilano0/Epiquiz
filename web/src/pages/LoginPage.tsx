import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { useAuth } from "../features/auth/AuthContext";
import { GENERIC_ERROR } from "../api/client";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      badge="Content de te revoir"
      tagline="Connecte-toi pour créer, lancer et partager tes quiz en temps réel avec tes amis !"
      switchText="Pas encore de compte ?"
      switchLabel="Créer un compte"
      switchTo="/register"
    >
      <h2 id="card-title">Connexion</h2>
      <form onSubmit={onSubmit}>
        <label>
          E-mail
          <input
            type="email"
            autoComplete="email"
            placeholder="toi@exemple.fr"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Ton mot de passe"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </AuthLayout>
  );
}
