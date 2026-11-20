import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GENERIC_ERROR } from "../api/client";
import { createQuiz, deleteQuiz, listQuizzes, type QuizSummary } from "../api/quizzes";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export function DashboardPage() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    listQuizzes()
      .then((list) => {
        if (active) setQuizzes(list);
      })
      .catch(() => {
        if (active) setError(GENERIC_ERROR);
      });
    return () => {
      active = false;
    };
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      setError("Donne un titre à ton quiz.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const quiz = await createQuiz(trimmed, "");
      navigate(`/quizzes/${quiz.id}`);
    } catch {
      setError(GENERIC_ERROR);
      setCreating(false);
    }
  }

  async function onDelete(quiz: QuizSummary) {
    if (!window.confirm(`Supprimer le quiz « ${quiz.title} » et toutes ses questions ?`)) {
      return;
    }
    setError(null);
    try {
      await deleteQuiz(quiz.id);
      setQuizzes((current) => current?.filter((item) => item.id !== quiz.id) ?? null);
    } catch {
      setError(GENERIC_ERROR);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mes quiz</h1>
          <p className="hint">Crée, modifie et prépare tes quiz avant de lancer une partie.</p>
        </div>
        <form className="create-form" onSubmit={onCreate} noValidate>
          <input
            type="text"
            aria-label="Titre du nouveau quiz"
            placeholder="Titre du nouveau quiz"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? "Création…" : "Créer un quiz"}
          </button>
        </form>
      </div>

      {error && <p role="alert">{error}</p>}

      {quizzes === null && !error && <p className="hint">Chargement…</p>}

      {quizzes?.length === 0 && (
        <p className="empty">Tu n'as pas encore de quiz. Donne un titre ci-dessus pour créer le premier.</p>
      )}

      {quizzes && quizzes.length > 0 && (
        <ul className="quiz-grid">
          {quizzes.map((quiz) => (
            <li key={quiz.id} className="quiz-card">
              <h2>{quiz.title}</h2>
              {quiz.description && <p>{quiz.description}</p>}
              <p className="meta">
                {quiz.questionCount} {quiz.questionCount > 1 ? "questions" : "question"} · modifié le{" "}
                {dateFormat.format(new Date(quiz.updatedAt))}
              </p>
              <div className="card-actions">
                <Link to={`/quizzes/${quiz.id}`} className="btn-ghost">
                  Modifier
                </Link>
                <button type="button" className="btn-ghost btn-danger" onClick={() => onDelete(quiz)}>
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
