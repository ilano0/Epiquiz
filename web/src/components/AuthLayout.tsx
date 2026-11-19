import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "./Logo";

interface AuthLayoutProps {
  badge: string;
  tagline: string;
  switchText: string;
  switchLabel: string;
  switchTo: string;
  children: ReactNode;
}

export function AuthLayout({ badge, tagline, switchText, switchLabel, switchTo, children }: AuthLayoutProps) {
  return (
    <div className="shell">
      <header className="topbar">
        <Logo />
        <Link to={switchTo} className="pill-link">
          {switchLabel}
        </Link>
      </header>

      <main className="auth">
        <section className="hero">
          <span className="badge">{badge}</span>
          <h1 className="brand">
            Epi<span>Quiz</span>
          </h1>
          <p className="tagline">{tagline}</p>
        </section>

        <section className="card" aria-labelledby="card-title">
          {children}
          <p className="switch">
            {switchText} <Link to={switchTo}>{switchLabel}</Link>
          </p>
        </section>
      </main>

      <footer className="footer">
        <Logo size="sm" />
      </footer>
    </div>
  );
}
