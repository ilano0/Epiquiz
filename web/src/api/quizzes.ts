import { request } from "./client";

export type QuestionType = "single" | "multiple" | "true_false" | "text";

export interface Option {
  id: string;
  position: number;
  text: string;
  mediaKey: string | null;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  position: number;
  type: QuestionType;
  text: string;
  mediaKey: string | null;
  durationS: number;
  points: number;
  options: Option[];
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  questions: Question[];
}

export interface OptionInput {
  text: string;
  isCorrect: boolean;
}

export interface QuestionInput {
  type: QuestionType;
  text: string;
  durationS: number;
  points: number;
  options: OptionInput[];
}

export async function listQuizzes(): Promise<QuizSummary[]> {
  return (await request<{ quizzes: QuizSummary[] }>("/quizzes")).quizzes;
}

export async function getQuiz(id: string): Promise<Quiz> {
  return (await request<{ quiz: Quiz }>(`/quizzes/${id}`)).quiz;
}

export async function createQuiz(title: string, description: string): Promise<Quiz> {
  return (await request<{ quiz: Quiz }>("/quizzes", { method: "POST", body: { title, description } })).quiz;
}

export async function updateQuiz(id: string, patch: { title?: string; description?: string }): Promise<Quiz> {
  return (await request<{ quiz: Quiz }>(`/quizzes/${id}`, { method: "PATCH", body: patch })).quiz;
}

export function deleteQuiz(id: string): Promise<void> {
  return request<void>(`/quizzes/${id}`, { method: "DELETE" });
}

export async function addQuestion(quizId: string, input: QuestionInput): Promise<Question> {
  return (
    await request<{ question: Question }>(`/quizzes/${quizId}/questions`, { method: "POST", body: input })
  ).question;
}

export async function updateQuestion(quizId: string, questionId: string, input: QuestionInput): Promise<Question> {
  return (
    await request<{ question: Question }>(`/quizzes/${quizId}/questions/${questionId}`, {
      method: "PUT",
      body: input,
    })
  ).question;
}

export function deleteQuestion(quizId: string, questionId: string): Promise<void> {
  return request<void>(`/quizzes/${quizId}/questions/${questionId}`, { method: "DELETE" });
}

export async function reorderQuestions(quizId: string, questionIds: string[]): Promise<Quiz> {
  return (
    await request<{ quiz: Quiz }>(`/quizzes/${quizId}/questions/order`, {
      method: "PUT",
      body: { questionIds },
    })
  ).quiz;
}
