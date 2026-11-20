import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GENERIC_ERROR } from "../api/client";
import {
  addQuestion,
  deleteQuestion,
  getQuiz,
  reorderQuestions,
  updateQuestion,
  updateQuiz,
  type QuestionInput,
  type Quiz,
} from "../api/quizzes";
import { QuestionForm } from "../features/quiz-editor/QuestionForm";
import { QuestionList } from "../features/quiz-editor/QuestionList";
import { QuizDetailsForm } from "../features/quiz-editor/QuizDetailsForm";
import { newDraft, toDraft } from "../features/quiz-editor/questions";

const NEW_QUESTION = "new";

export function StudioPage() {
  const { id = "" } = useParams();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setQuiz(null);
    setLoadError(null);
    setSelected(null);
    getQuiz(id)
      .then((loaded) => {
        if (active) setQuiz(loaded);
      })
      .catch(() => {
        if (active) setLoadError(GENERIC_ERROR);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loadError) {
    return (
      <>
        <p role="alert">{loadError}</p>
        <Link to="/" className="btn-ghost">
          Retour à mes quiz
        </Link>
      </>
    );
  }

  if (!quiz) {
    return <p className="hint">Chargement…</p>;
  }

  const current = quiz;
  const selectedQuestion = current.questions.find((question) => question.id === selected) ?? null;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch {
      setActionError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function saveDetails(title: string, description: string) {
    setQuiz(await updateQuiz(current.id, { title, description }));
  }

  async function saveQuestion(input: QuestionInput) {
    if (selected === NEW_QUESTION) {
      const created = await addQuestion(current.id, input);
      setQuiz({ ...current, questions: [...current.questions, created] });
      setSelected(created.id);
      return;
    }
    if (selectedQuestion) {
      const updated = await updateQuestion(current.id, selectedQuestion.id, input);
      setQuiz({
        ...current,
        questions: current.questions.map((question) => (question.id === updated.id ? updated : question)),
      });
    }
  }

  function moveQuestion(index: number, delta: -1 | 1) {
    const ids = current.questions.map((question) => question.id);
    const target = index + delta;
    const moved = ids[index];
    const other = ids[target];
    if (moved === undefined || other === undefined) return;
    ids[index] = other;
    ids[target] = moved;
    void run(async () => {
      setQuiz(await reorderQuestions(current.id, ids));
    });
  }

  function removeQuestion(questionId: string) {
    if (!window.confirm("Supprimer cette question ?")) return;
    void run(async () => {
      await deleteQuestion(current.id, questionId);
      setQuiz({
        ...current,
        questions: current.questions
          .filter((question) => question.id !== questionId)
          .map((question, position) => ({ ...question, position })),
      });
      if (selected === questionId) setSelected(null);
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/" className="back-link">
            ← Mes quiz
          </Link>
          <h1>{current.title}</h1>
        </div>
      </div>

      {actionError && <p role="alert">{actionError}</p>}

      <div className="studio">
        <aside className="studio-side">
          <section className="panel" aria-labelledby="details-title">
            <h2 id="details-title">Le quiz</h2>
            <QuizDetailsForm
              key={current.id}
              title={current.title}
              description={current.description}
              onSave={saveDetails}
            />
          </section>

          <section className="panel" aria-labelledby="questions-title">
            <h2 id="questions-title">Questions ({current.questions.length})</h2>
            <QuestionList
              questions={current.questions}
              selectedId={selected}
              busy={busy}
              onSelect={setSelected}
              onMove={moveQuestion}
              onDelete={removeQuestion}
            />
            <button
              type="button"
              className="btn-primary add-question"
              disabled={busy}
              onClick={() => setSelected(NEW_QUESTION)}
            >
              + Ajouter une question
            </button>
          </section>
        </aside>

        <section className="panel editor" aria-labelledby="editor-title">
          {selected === NEW_QUESTION && (
            <>
              <h2 id="editor-title">Nouvelle question</h2>
              <QuestionForm
                key={NEW_QUESTION}
                initial={newDraft()}
                submitLabel="Ajouter la question"
                onSubmit={saveQuestion}
                onCancel={() => setSelected(null)}
              />
            </>
          )}
          {selectedQuestion && (
            <>
              <h2 id="editor-title">Modifier la question</h2>
              <QuestionForm
                key={selectedQuestion.id}
                initial={toDraft(selectedQuestion)}
                submitLabel="Enregistrer la question"
                onSubmit={saveQuestion}
                onCancel={() => setSelected(null)}
              />
            </>
          )}
          {selected === null && (
            <>
              <h2 id="editor-title">Éditeur</h2>
              <p className="hint">
                Sélectionne une question dans la liste pour la modifier, ou ajoute-en une nouvelle.
              </p>
            </>
          )}
        </section>
      </div>
    </>
  );
}
