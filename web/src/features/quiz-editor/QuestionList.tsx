import type { Question } from "../../api/quizzes";
import { TYPE_LABELS } from "./questions";

interface QuestionListProps {
  questions: Question[];
  selectedId: string | null;
  busy: boolean;
  onSelect: (id: string) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onDelete: (id: string) => void;
}

export function QuestionList({ questions, selectedId, busy, onSelect, onMove, onDelete }: QuestionListProps) {
  if (questions.length === 0) {
    return <p className="hint">Aucune question pour l'instant. Ajoute la première !</p>;
  }

  return (
    <ol className="q-list">
      {questions.map((question, index) => (
        <li key={question.id} className={question.id === selectedId ? "q-item selected" : "q-item"}>
          <button type="button" className="q-select" onClick={() => onSelect(question.id)}>
            <span className="q-num">Question {index + 1}</span>
            <span className="q-title">{question.text}</span>
            <span className="q-type">
              {TYPE_LABELS[question.type]} · {question.durationS} s · {question.points} pts
            </span>
          </button>
          <div className="q-tools">
            <button
              type="button"
              className="icon-btn"
              aria-label={`Monter la question ${index + 1}`}
              disabled={busy || index === 0}
              onClick={() => onMove(index, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Descendre la question ${index + 1}`}
              disabled={busy || index === questions.length - 1}
              onClick={() => onMove(index, 1)}
            >
              ↓
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Supprimer la question ${index + 1}`}
              disabled={busy}
              onClick={() => onDelete(question.id)}
            >
              ✕
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
