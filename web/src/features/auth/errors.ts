import { ApiError } from "../../api/client";

const MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  email_already_used: "Un compte existe déjà avec cet e-mail.",
  invalid_input: "Vérifie les champs du formulaire.",
  too_many_requests: "Trop de tentatives. Réessaie dans une minute.",
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return MESSAGES[err.code] ?? "Une erreur est survenue. Réessaie plus tard.";
  }
  return "Impossible de joindre le serveur.";
}
