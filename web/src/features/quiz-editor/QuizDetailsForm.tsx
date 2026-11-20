import { useState, type FormEvent } from "react";
import { GENERIC_ERROR } from "../../api/client";

interface QuizDetailsFormProps {
  title: string;
  description: string;
  onSave: (title: string, description: string) => Promise<void>;
}

export function QuizDetailsForm({ title, description, onSave }: QuizDetailsFormProps) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDescription, setDraftDescription] = useState(description);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = draftTitle.trim() !== title || draftDescription.trim() !== description;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (draftTitle.trim().length === 0) {
      setError("Le titre ne peut pas être vide.");
      return;
    }
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await onSave(draftTitle.trim(), draftDescription.trim());
      setSaved(true);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label>
        Titre du quiz
        <input
          type="text"
          maxLength={120}
          value={draftTitle}
          onChange={(e) => {
            setDraftTitle(e.target.value);
            setSaved(false);
          }}
        />
      </label>
      <label>
        Description
        <textarea
          rows={3}
          maxLength={1000}
          placeholder="De quoi parle ce quiz ?"
          value={draftDescription}
          onChange={(e) => {
            setDraftDescription(e.target.value);
            setSaved(false);
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={saving || !dirty}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && !dirty && <span className="saved">Enregistré</span>}
      </div>
    </form>
  );
}
