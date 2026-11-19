import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../db/transaction.js";

export const MAX_QUESTIONS_PER_QUIZ = 100;

export const QUESTION_TYPES = ["single", "multiple", "true_false", "text"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

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
  settings: Record<string, unknown>;
  options: Option[];
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  questions: Question[];
}

export class QuizInUseError extends Error {
  constructor() {
    super("quiz_has_games");
  }
}

export class QuestionLimitError extends Error {
  constructor() {
    super("question_limit_reached");
  }
}

export class InvalidOrderError extends Error {
  constructor() {
    super("invalid_order");
  }
}

interface QuizRow {
  id: string;
  title: string;
  description: string;
  created_at: Date;
  updated_at: Date;
}

interface QuestionRow {
  id: string;
  position: number;
  type: QuestionType;
  text: string;
  media_key: string | null;
  duration_s: number;
  points: number;
  settings: Record<string, unknown>;
}

interface OptionRow {
  id: string;
  question_id: string;
  position: number;
  text: string;
  media_key: string | null;
  is_correct: boolean;
}

const RESTRICT_VIOLATIONS = new Set(["23001", "23503"]);

type Db = Pool | PoolClient;

function toOption(row: OptionRow): Option {
  return {
    id: row.id,
    position: row.position,
    text: row.text,
    mediaKey: row.media_key,
    isCorrect: row.is_correct,
  };
}

function toQuestion(row: QuestionRow, options: Option[]): Question {
  return {
    id: row.id,
    position: row.position,
    type: row.type,
    text: row.text,
    mediaKey: row.media_key,
    durationS: row.duration_s,
    points: row.points,
    settings: row.settings,
    options,
  };
}

async function loadQuestions(db: Db, quizId: string, questionId: string | null = null): Promise<Question[]> {
  const questions = await db.query<QuestionRow>(
    `SELECT id, position, type, text, media_key, duration_s, points, settings
       FROM questions
      WHERE quiz_id = $1 AND ($2::uuid IS NULL OR id = $2::uuid)
      ORDER BY position`,
    [quizId, questionId],
  );
  if (questions.rows.length === 0) {
    return [];
  }

  const options = await db.query<OptionRow>(
    `SELECT id, question_id, position, text, media_key, is_correct
       FROM options
      WHERE question_id = ANY($1::uuid[])
      ORDER BY position`,
    [questions.rows.map((row) => row.id)],
  );

  const byQuestion = new Map<string, Option[]>();
  for (const row of options.rows) {
    const list = byQuestion.get(row.question_id) ?? [];
    list.push(toOption(row));
    byQuestion.set(row.question_id, list);
  }
  return questions.rows.map((row) => toQuestion(row, byQuestion.get(row.id) ?? []));
}

async function lockQuiz(client: PoolClient, quizId: string, ownerId: string): Promise<boolean> {
  const result = await client.query(
    "SELECT 1 FROM quizzes WHERE id = $1 AND owner_id = $2 FOR UPDATE",
    [quizId, ownerId],
  );
  return (result.rowCount ?? 0) > 0;
}

async function insertOptions(client: PoolClient, questionId: string, options: OptionInput[]): Promise<void> {
  await client.query(
    `INSERT INTO options (question_id, position, text, is_correct)
     SELECT $1::uuid, (t.pos - 1)::int, t.text, t.is_correct
       FROM unnest($2::text[], $3::boolean[]) WITH ORDINALITY AS t(text, is_correct, pos)`,
    [questionId, options.map((o) => o.text), options.map((o) => o.isCorrect)],
  );
}

async function touchQuiz(client: PoolClient, quizId: string): Promise<void> {
  await client.query("UPDATE quizzes SET updated_at = now() WHERE id = $1", [quizId]);
}

export function createQuizRepository(pool: Pool) {
  return {
    async list(ownerId: string): Promise<QuizSummary[]> {
      const result = await pool.query<QuizRow & { question_count: number }>(
        `SELECT q.id, q.title, q.description, q.created_at, q.updated_at,
                count(qs.id)::int AS question_count
           FROM quizzes q
           LEFT JOIN questions qs ON qs.quiz_id = q.id
          WHERE q.owner_id = $1
          GROUP BY q.id
          ORDER BY q.updated_at DESC`,
        [ownerId],
      );
      return result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        questionCount: row.question_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },

    async get(quizId: string, ownerId: string): Promise<Quiz | null> {
      const result = await pool.query<QuizRow>(
        `SELECT id, title, description, created_at, updated_at
           FROM quizzes WHERE id = $1 AND owner_id = $2`,
        [quizId, ownerId],
      );
      const row = result.rows[0];
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        questions: await loadQuestions(pool, quizId),
      };
    },

    async create(ownerId: string, input: { title: string; description: string }): Promise<Quiz> {
      const result = await pool.query<QuizRow>(
        `INSERT INTO quizzes (owner_id, title, description)
         VALUES ($1, $2, $3)
         RETURNING id, title, description, created_at, updated_at`,
        [ownerId, input.title, input.description],
      );
      const row = result.rows[0]!;
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        questions: [],
      };
    },

    async update(
      quizId: string,
      ownerId: string,
      patch: { title?: string | undefined; description?: string | undefined },
    ): Promise<boolean> {
      const result = await pool.query(
        `UPDATE quizzes
            SET title = COALESCE($3, title),
                description = COALESCE($4, description)
          WHERE id = $1 AND owner_id = $2`,
        [quizId, ownerId, patch.title ?? null, patch.description ?? null],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async remove(quizId: string, ownerId: string): Promise<boolean> {
      try {
        const result = await pool.query("DELETE FROM quizzes WHERE id = $1 AND owner_id = $2", [quizId, ownerId]);
        return (result.rowCount ?? 0) > 0;
      } catch (err) {
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          typeof err.code === "string" &&
          RESTRICT_VIOLATIONS.has(err.code)
        ) {
          throw new QuizInUseError();
        }
        throw err;
      }
    },

    addQuestion(quizId: string, ownerId: string, input: QuestionInput): Promise<Question | null> {
      return withTransaction(pool, async (client) => {
        if (!(await lockQuiz(client, quizId, ownerId))) {
          return null;
        }

        const stats = await client.query<{ count: number; next: number }>(
          `SELECT count(*)::int AS count, COALESCE(max(position) + 1, 0)::int AS next
             FROM questions WHERE quiz_id = $1`,
          [quizId],
        );
        const { count, next } = stats.rows[0]!;
        if (count >= MAX_QUESTIONS_PER_QUIZ) {
          throw new QuestionLimitError();
        }

        const inserted = await client.query<{ id: string }>(
          `INSERT INTO questions (quiz_id, position, type, text, duration_s, points)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [quizId, next, input.type, input.text, input.durationS, input.points],
        );
        const questionId = inserted.rows[0]!.id;
        await insertOptions(client, questionId, input.options);
        await touchQuiz(client, quizId);
        return (await loadQuestions(client, quizId, questionId))[0]!;
      });
    },

    updateQuestion(
      quizId: string,
      ownerId: string,
      questionId: string,
      input: QuestionInput,
    ): Promise<Question | null> {
      return withTransaction(pool, async (client) => {
        if (!(await lockQuiz(client, quizId, ownerId))) {
          return null;
        }

        const updated = await client.query(
          `UPDATE questions
              SET type = $3, text = $4, duration_s = $5, points = $6
            WHERE id = $1 AND quiz_id = $2`,
          [questionId, quizId, input.type, input.text, input.durationS, input.points],
        );
        if ((updated.rowCount ?? 0) === 0) {
          return null;
        }

        await client.query("DELETE FROM options WHERE question_id = $1", [questionId]);
        await insertOptions(client, questionId, input.options);
        await touchQuiz(client, quizId);
        return (await loadQuestions(client, quizId, questionId))[0]!;
      });
    },

    removeQuestion(quizId: string, ownerId: string, questionId: string): Promise<boolean> {
      return withTransaction(pool, async (client) => {
        if (!(await lockQuiz(client, quizId, ownerId))) {
          return false;
        }

        const deleted = await client.query("DELETE FROM questions WHERE id = $1 AND quiz_id = $2", [
          questionId,
          quizId,
        ]);
        if ((deleted.rowCount ?? 0) === 0) {
          return false;
        }

        await client.query(
          `UPDATE questions q
              SET position = r.rn
             FROM (SELECT id, (row_number() OVER (ORDER BY position) - 1)::int AS rn
                     FROM questions WHERE quiz_id = $1) r
            WHERE q.id = r.id AND q.position <> r.rn`,
          [quizId],
        );
        await touchQuiz(client, quizId);
        return true;
      });
    },

    reorderQuestions(quizId: string, ownerId: string, questionIds: string[]): Promise<boolean> {
      return withTransaction(pool, async (client) => {
        if (!(await lockQuiz(client, quizId, ownerId))) {
          return false;
        }

        const existing = await client.query<{ id: string }>("SELECT id FROM questions WHERE quiz_id = $1", [quizId]);
        const existingIds = new Set(existing.rows.map((row) => row.id));
        const requested = new Set(questionIds);
        const sameSet =
          requested.size === questionIds.length &&
          requested.size === existingIds.size &&
          questionIds.every((id) => existingIds.has(id));
        if (!sameSet) {
          throw new InvalidOrderError();
        }

        await client.query(
          `UPDATE questions q
              SET position = (t.pos - 1)::int
             FROM unnest($2::uuid[]) WITH ORDINALITY AS t(id, pos)
            WHERE q.id = t.id AND q.quiz_id = $1`,
          [quizId, questionIds],
        );
        await touchQuiz(client, quizId);
        return true;
      });
    },
  };
}

export type QuizRepository = ReturnType<typeof createQuizRepository>;
