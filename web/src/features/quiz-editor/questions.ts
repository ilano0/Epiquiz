import type { OptionInput, Question, QuestionInput, QuestionType } from "../../api/quizzes";

export const TYPE_LABELS: Record<QuestionType, string> = {
  single: "Choix unique",
  multiple: "Choix multiples",
  true_false: "Vrai ou faux",
  text: "Réponse libre",
};

export const TYPE_ORDER: QuestionType[] = ["single", "multiple", "true_false", "text"];

export const OPTION_LIMITS: Record<QuestionType, { min: number; max: number }> = {
  single: { min: 2, max: 6 },
  multiple: { min: 2, max: 6 },
  true_false: { min: 2, max: 2 },
  text: { min: 1, max: 10 },
};

export interface QuestionDraft {
  type: QuestionType;
  text: string;
  durationS: number;
  points: number;
  options: OptionInput[];
}

export function blankOptions(type: QuestionType): OptionInput[] {
  if (type === "true_false") {
    return [
      { text: "Vrai", isCorrect: true },
      { text: "Faux", isCorrect: false },
    ];
  }
  const count = OPTION_LIMITS[type].min;
  return Array.from({ length: count }, (_, index) => ({
    text: "",
    isCorrect: type === "text" || (type === "single" && index === 0),
  }));
}

export function newDraft(): QuestionDraft {
  return { type: "single", text: "", durationS: 20, points: 1000, options: blankOptions("single") };
}

export function toDraft(question: Question): QuestionDraft {
  return {
    type: question.type,
    text: question.text,
    durationS: question.durationS,
    points: question.points,
    options: question.options.map((option) => ({ text: option.text, isCorrect: option.isCorrect })),
  };
}

export function normalizeOptions(type: QuestionType, options: OptionInput[]): OptionInput[] {
  if (type === "true_false") {
    const [first, second] = options;
    const isTrueFalse = first?.text === "Vrai" && second?.text === "Faux" && options.length === 2;
    return isTrueFalse ? options : blankOptions(type);
  }

  const { min, max } = OPTION_LIMITS[type];
  const next = options.slice(0, max);
  while (next.length < min) {
    next.push({ text: "", isCorrect: false });
  }

  if (type === "text") {
    return next.map((option) => ({ ...option, isCorrect: true }));
  }

  const firstCorrect = next.findIndex((option) => option.isCorrect);
  if (type === "single") {
    const keep = firstCorrect === -1 ? 0 : firstCorrect;
    return next.map((option, index) => ({ ...option, isCorrect: index === keep }));
  }
  if (firstCorrect === -1) {
    return next.map((option, index) => ({ ...option, isCorrect: index === 0 }));
  }
  return next;
}

export function validateDraft(draft: QuestionDraft): string | null {
  const text = draft.text.trim();

  if (text.length === 0) {
    return "Écris l'énoncé de la question.";
  }
  if (text.length > 500) {
    return "L'énoncé ne peut pas dépasser 500 caractères.";
  }
  if (!Number.isInteger(draft.durationS) || draft.durationS < 5 || draft.durationS > 300) {
    return "La durée doit être comprise entre 5 et 300 secondes.";
  }
  if (!Number.isInteger(draft.points) || draft.points < 0 || draft.points > 10000) {
    return "Les points doivent être compris entre 0 et 10 000.";
  }

  if (draft.options.some((option) => option.text.trim().length === 0)) {
    return "Remplis toutes les réponses ou supprime celles qui sont vides.";
  }
  if (draft.options.some((option) => option.text.trim().length > 200)) {
    return "Une réponse ne peut pas dépasser 200 caractères.";
  }

  const correct = draft.options.filter((option) => option.isCorrect).length;
  if (draft.type === "multiple" && correct < 1) {
    return "Coche au moins une bonne réponse.";
  }
  if ((draft.type === "single" || draft.type === "true_false") && correct !== 1) {
    return "Choisis une bonne réponse.";
  }
  return null;
}

export function toInput(draft: QuestionDraft): QuestionInput {
  return {
    type: draft.type,
    text: draft.text.trim(),
    durationS: draft.durationS,
    points: draft.points,
    options: draft.options.map((option) => ({ text: option.text.trim(), isCorrect: option.isCorrect })),
  };
}
