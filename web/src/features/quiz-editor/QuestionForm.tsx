import { useState, type FormEvent } from "react";
import { GENERIC_ERROR } from "../../api/client";
import type { OptionInput, QuestionInput, QuestionType } from "../../api/quizzes";
import {
  OPTION_LIMITS,
  TYPE_LABELS,
  TYPE_ORDER,
  blankOptions,
  normalizeOptions,
  toInput,
  validateDraft,
  type QuestionDraft,
} from "./questions";

interface QuestionFormProps {
  initial: QuestionDraft;
  submitLabel: string;
  onSubmit: (input: QuestionInput) => Promise<void>;
  onCancel: () => void;
}

const HINTS: Record<QuestionType, string> = {
  single: "Une seule réponse est correcte. Sélectionne-la avec le bouton rond.",
  multiple: "Coche toutes les bonnes réponses.",
  true_false: "Choisis si l'affirmation est vraie ou fausse.",
  text: "Les joueurs écrivent leur réponse. Chaque réponse saisie ici est acceptée.",
};

export function QuestionForm({ initial, submitLabel, onSubmit, onCancel }: QuestionFormProps) {
  const [draft, setDraft] = useState<QuestionDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const limits = OPTION_LIMITS[draft.type];
  const canRemove = draft.type !== "true_false" && draft.options.length > limits.min;
  const canAdd = draft.type !== "true_false" && draft.options.length < limits.max;

  function changeType(type: QuestionType) {
    setDraft((current) => ({
      ...current,
      type,
      options:
        current.type === "true_false" ? blankOptions(type) : normalizeOptions(type, current.options),
    }));
  }

  function patchOption(index: number, patch: Partial<OptionInput>) {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option, i) => (i === index ? { ...option, ...patch } : option)),
    }));
  }

  function pickCorrect(index: number) {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option, i) => ({ ...option, isCorrect: i === index })),
    }));
  }

  function addOption() {
    setDraft((current) => ({
      ...current,
      options: [...current.options, { text: "", isCorrect: current.type === "text" }],
    }));
  }

  function removeOption(index: number) {
    setDraft((current) => ({
      ...current,
      options: normalizeOptions(
        current.type,
        current.options.filter((_, i) => i !== index),
      ),
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validateDraft(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(toInput(draft));
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label>
        Type de question
        <select value={draft.type} onChange={(e) => changeType(e.target.value as QuestionType)}>
          {TYPE_ORDER.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Énoncé
        <textarea
          rows={3}
          maxLength={500}
          placeholder="Quelle est la capitale de la France ?"
          value={draft.text}
          onChange={(e) => setDraft((current) => ({ ...current, text: e.target.value }))}
        />
      </label>

      <fieldset className="options">
        <legend>{draft.type === "text" ? "Réponses acceptées" : "Réponses"}</legend>
        <p className="hint">{HINTS[draft.type]}</p>
        {draft.options.map((option, index) => (
          <div className="option-row" key={index}>
            {draft.type === "multiple" && (
              <input
                type="checkbox"
                checked={option.isCorrect}
                aria-label={`Réponse ${index + 1} correcte`}
                onChange={(e) => patchOption(index, { isCorrect: e.target.checked })}
              />
            )}
            {(draft.type === "single" || draft.type === "true_false") && (
              <input
                type="radio"
                name="correct-option"
                checked={option.isCorrect}
                aria-label={`Réponse ${index + 1} correcte`}
                onChange={() => pickCorrect(index)}
              />
            )}
            <input
              type="text"
              value={option.text}
              readOnly={draft.type === "true_false"}
              maxLength={200}
              aria-label={draft.type === "text" ? `Réponse acceptée ${index + 1}` : `Réponse ${index + 1}`}
              placeholder={draft.type === "text" ? "Réponse acceptée" : `Réponse ${index + 1}`}
              onChange={(e) => patchOption(index, { text: e.target.value })}
            />
            {canRemove && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Supprimer la réponse ${index + 1}`}
                onClick={() => removeOption(index)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {canAdd && (
          <button type="button" className="btn-ghost add-option" onClick={addOption}>
            + Ajouter une réponse
          </button>
        )}
      </fieldset>

      <div className="row">
        <label>
          Durée (secondes)
          <input
            type="number"
            min={5}
            max={300}
            value={Number.isNaN(draft.durationS) ? "" : draft.durationS}
            onChange={(e) => setDraft((current) => ({ ...current, durationS: e.target.valueAsNumber }))}
          />
        </label>
        <label>
          Points
          <input
            type="number"
            min={0}
            max={10000}
            step={100}
            value={Number.isNaN(draft.points) ? "" : draft.points}
            onChange={(e) => setDraft((current) => ({ ...current, points: e.target.valueAsNumber }))}
          />
        </label>
      </div>

      {error && <p role="alert">{error}</p>}

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Enregistrement…" : submitLabel}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>
          Annuler
        </button>
      </div>
    </form>
  );
}
