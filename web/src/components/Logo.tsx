import { Link } from "react-router-dom";

export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <Link to="/" className={`logo logo-${size}`} aria-label="EpiQuiz, accueil">
      <span className="logo-mark" aria-hidden="true">
        ?
      </span>
      <span className="logo-text">EpiQuiz</span>
    </Link>
  );
}
