import type { Pool } from "pg";
import { withTransaction } from "../db/transaction.js";
import type { Question } from "./quizzes.js";

export interface GameRecord {
  id: string;
  quizId: string;
  hostId: string;
  pin: string;
  mode: string;
  status: "lobby" | "running" | "finished";
}

export class PinConflictError extends Error {
  constructor() {
    super("pin_conflict");
  }
}

interface GameRow {
  id: string;
  quiz_id: string;
  host_id: string;
  pin: string;
  mode: string;
  status: GameRecord["status"];
}

function toRecord(row: GameRow): GameRecord {
  return {
    id: row.id,
    quizId: row.quiz_id,
    hostId: row.host_id,
    pin: row.pin,
    mode: row.mode,
    status: row.status,
  };
}

export function createGameRepository(pool: Pool) {
  return {
    async create(input: {
      id: string;
      quizId: string;
      hostId: string;
      pin: string;
      questions: Question[];
    }): Promise<GameRecord> {
      try {
        return await withTransaction(pool, async (client) => {
          const result = await client.query<GameRow>(
            `INSERT INTO games (id, quiz_id, host_id, pin)
             VALUES ($1, $2, $3, $4)
             RETURNING id, quiz_id, host_id, pin, mode, status`,
            [input.id, input.quizId, input.hostId, input.pin],
          );
          await client.query(
            `INSERT INTO game_questions (game_id, position, question_snapshot)
             SELECT $1, ordinality - 1, snapshot
               FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS t(snapshot, ordinality)`,
            [input.id, JSON.stringify(input.questions)],
          );
          return toRecord(result.rows[0]!);
        });
      } catch (err) {
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          err.code === "23505" &&
          "constraint" in err &&
          err.constraint === "games_active_pin_unique"
        ) {
          throw new PinConflictError();
        }
        throw err;
      }
    },

    async findActive(gameId: string, hostId: string): Promise<GameRecord | null> {
      const result = await pool.query<GameRow>(
        `SELECT id, quiz_id, host_id, pin, mode, status
           FROM games
          WHERE id = $1 AND host_id = $2 AND status <> 'finished'`,
        [gameId, hostId],
      );
      const row = result.rows[0];
      return row ? toRecord(row) : null;
    },
  };
}

export type GameRepository = ReturnType<typeof createGameRepository>;
