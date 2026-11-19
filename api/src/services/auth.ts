import { hash, verify } from "argon2";
import { jwtVerify, SignJWT } from "jose";
import { EmailAlreadyUsedError, type User, type UserRepository } from "../repositories/users.js";

export const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

export class InvalidCredentialsError extends Error {
  constructor() {
    super("invalid_credentials");
  }
}

export { EmailAlreadyUsedError };

export function createAuthService(users: UserRepository, jwtSecret: string) {
  const key = new TextEncoder().encode(jwtSecret);
  const dummyHash = hash("epiquiz-dummy-password");

  async function issueToken(userId: string): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_MAX_AGE_S}s`)
      .sign(key);
  }

  return {
    async register(input: { email: string; password: string; displayName: string }): Promise<{ user: User; token: string }> {
      const passwordHash = await hash(input.password);
      const user = await users.create({
        email: input.email,
        passwordHash,
        displayName: input.displayName,
      });
      return { user, token: await issueToken(user.id) };
    },

    async login(input: { email: string; password: string }): Promise<{ user: User; token: string }> {
      const found = await users.findByEmail(input.email);
      const valid = await verify(found?.passwordHash ?? (await dummyHash), input.password);
      if (!found || !valid) {
        throw new InvalidCredentialsError();
      }
      const user: User = { id: found.id, email: found.email, displayName: found.displayName };
      return { user, token: await issueToken(user.id) };
    },

    async verifyToken(token: string): Promise<string | null> {
      try {
        const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
        return payload.sub ?? null;
      } catch {
        return null;
      }
    },

    findUser(id: string): Promise<User | null> {
      return users.findById(id);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
