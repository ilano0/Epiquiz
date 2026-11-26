import type { RedisClient } from "./redis.js";

export const GAME_TTL_S = 24 * 60 * 60;

export const GAME_STATES = ["LOBBY", "QUESTION", "REVEAL", "LEADERBOARD", "PAUSED", "FINISHED"] as const;
export type GameStateName = (typeof GAME_STATES)[number];

export interface LiveGame {
  pin: string;
  gameId: string;
  hostId: string;
  quizId: string;
  title: string;
  mode: string;
  state: GameStateName;
  questionIndex: number;
  totalQuestions: number;
  createdAt: number;
}

export interface LivePlayer {
  playerId: string;
  nickname: string;
  joinedAt: number;
}

export type AddPlayerResult = "OK" | "GAME_NOT_FOUND" | "GAME_STARTED" | "NICKNAME_TAKEN";

const keys = {
  game: (pin: string) => `game:${pin}`,
  players: (pin: string) => `game:${pin}:players`,
  nicknames: (pin: string) => `game:${pin}:nicknames`,
  scores: (pin: string) => `game:${pin}:scores`,
  pin: (pin: string) => `pin:${pin}`,
};

const ADD_PLAYER_SCRIPT = `
local state = redis.call('HGET', KEYS[1], 'state')
if not state then return 'GAME_NOT_FOUND' end
if state ~= 'LOBBY' then return 'GAME_STARTED' end
if redis.call('SADD', KEYS[3], ARGV[2]) == 0 then return 'NICKNAME_TAKEN' end
redis.call('HSET', KEYS[2], ARGV[1], ARGV[3])
for i = 1, #KEYS do redis.call('EXPIRE', KEYS[i], ARGV[4]) end
return 'OK'
`;

const REMOVE_PLAYER_SCRIPT = `
local raw = redis.call('HGET', KEYS[1], ARGV[1])
if not raw then return 0 end
redis.call('HDEL', KEYS[1], ARGV[1])
redis.call('SREM', KEYS[2], ARGV[2])
redis.call('ZREM', KEYS[3], ARGV[1])
return 1
`;

function parseGame(pin: string, hash: Record<string, string>): LiveGame | null {
  if (!hash.state || !hash.gameId) {
    return null;
  }
  return {
    pin,
    gameId: hash.gameId,
    hostId: hash.hostId ?? "",
    quizId: hash.quizId ?? "",
    title: hash.title ?? "",
    mode: hash.mode ?? "classic",
    state: hash.state as GameStateName,
    questionIndex: Number(hash.questionIndex ?? -1),
    totalQuestions: Number(hash.totalQuestions ?? 0),
    createdAt: Number(hash.createdAt ?? 0),
  };
}

export function createGameStateRepository(redis: RedisClient) {
  return {
    async reservePin(pin: string, gameId: string): Promise<boolean> {
      const result = await redis.set(keys.pin(pin), gameId, {
        condition: "NX",
        expiration: { type: "EX", value: GAME_TTL_S },
      });
      return result === "OK";
    },

    async releasePin(pin: string): Promise<void> {
      await redis.del(keys.pin(pin));
    },

    async createGame(game: LiveGame): Promise<void> {
      await redis
        .multi()
        .hSet(keys.game(game.pin), {
          gameId: game.gameId,
          hostId: game.hostId,
          quizId: game.quizId,
          title: game.title,
          mode: game.mode,
          state: game.state,
          questionIndex: String(game.questionIndex),
          totalQuestions: String(game.totalQuestions),
          createdAt: String(game.createdAt),
        })
        .expire(keys.game(game.pin), GAME_TTL_S)
        .exec();
    },

    async getGame(pin: string): Promise<LiveGame | null> {
      return parseGame(pin, await redis.hGetAll(keys.game(pin)));
    },

    async addPlayer(pin: string, player: LivePlayer, nicknameKey: string): Promise<AddPlayerResult> {
      const result = await redis.eval(ADD_PLAYER_SCRIPT, {
        keys: [keys.game(pin), keys.players(pin), keys.nicknames(pin), keys.pin(pin)],
        arguments: [
          player.playerId,
          nicknameKey,
          JSON.stringify({ nickname: player.nickname, joinedAt: player.joinedAt }),
          String(GAME_TTL_S),
        ],
      });
      return result as AddPlayerResult;
    },

    async getPlayer(pin: string, playerId: string): Promise<LivePlayer | null> {
      const raw = await redis.hGet(keys.players(pin), playerId);
      if (!raw) {
        return null;
      }
      const data = JSON.parse(raw) as { nickname: string; joinedAt: number };
      return { playerId, nickname: data.nickname, joinedAt: data.joinedAt };
    },

    async removePlayer(pin: string, playerId: string, nicknameKey: string): Promise<boolean> {
      const removed = await redis.eval(REMOVE_PLAYER_SCRIPT, {
        keys: [keys.players(pin), keys.nicknames(pin), keys.scores(pin)],
        arguments: [playerId, nicknameKey],
      });
      return removed === 1;
    },

    async listPlayers(pin: string): Promise<LivePlayer[]> {
      const hash = await redis.hGetAll(keys.players(pin));
      return Object.entries(hash)
        .map(([playerId, raw]) => {
          const data = JSON.parse(raw) as { nickname: string; joinedAt: number };
          return { playerId, nickname: data.nickname, joinedAt: data.joinedAt };
        })
        .sort((a, b) => a.joinedAt - b.joinedAt);
    },
  };
}

export type GameStateRepository = ReturnType<typeof createGameStateRepository>;
