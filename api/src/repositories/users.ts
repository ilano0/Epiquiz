import type { Pool } from "pg";

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface UserWithHash extends User {
  passwordHash: string;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
}

const UNIQUE_VIOLATION = "23505";

export class EmailAlreadyUsedError extends Error {
  constructor() {
    super("email_already_used");
  }
}

function toUser(row: UserRow): User {
  return { id: row.id, email: row.email, displayName: row.display_name };
}

export function createUserRepository(pool: Pool) {
  return {
    async create(input: { email: string; passwordHash: string; displayName: string }): Promise<User> {
      try {
        const result = await pool.query<UserRow>(
          `INSERT INTO users (email, password_hash, display_name)
           VALUES ($1, $2, $3)
           RETURNING id, email, display_name, password_hash`,
          [input.email, input.passwordHash, input.displayName],
        );
        return toUser(result.rows[0]!);
      } catch (err) {
        if (typeof err === "object" && err !== null && "code" in err && err.code === UNIQUE_VIOLATION) {
          throw new EmailAlreadyUsedError();
        }
        throw err;
      }
    },

    async findByEmail(email: string): Promise<UserWithHash | null> {
      const result = await pool.query<UserRow>(
        "SELECT id, email, display_name, password_hash FROM users WHERE lower(email) = lower($1)",
        [email],
      );
      const row = result.rows[0];
      return row ? { ...toUser(row), passwordHash: row.password_hash } : null;
    },

    async findById(id: string): Promise<User | null> {
      const result = await pool.query<UserRow>(
        "SELECT id, email, display_name, password_hash FROM users WHERE id = $1",
        [id],
      );
      const row = result.rows[0];
      return row ? toUser(row) : null;
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
