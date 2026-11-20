import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { useAuth } from "../features/auth/AuthContext";
import { GENERIC_ERROR } from "../api/client";

export function RegisterPage() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
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
      await register(email, password, displayName);
      navigate("/", { replace: true });
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      badge="Le quiz nouvelle génération"
      tagline="Crée, joue et partage des quiz en temps réel avec tes amis !"
      switchText="Déjà un compte ?"
      switchLabel="Se connecter"
      switchTo="/login"
    >
      <h2 id="card-title">Créer un compte</h2>
      <form onSubmit={onSubmit}>
        <label>
          Nom affiché
          <input
            type="text"
            autoComplete="nickname"
            placeholder="Ilan"
            required
            maxLength={50}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
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
          Mot de passe (8 caractères minimum)
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Au moins 8 caractères"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Création…" : "Créer mon compte"}
        </button>
      </form>
    </AuthLayout>
  );
}
