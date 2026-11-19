import { createClient, type RedisClientType } from "redis";

export type RedisClient = RedisClientType;

export async function connectRedis(url: string): Promise<RedisClient> {
  const client: RedisClient = createClient({ url });
  client.on("error", (err: unknown) => {
    console.error("Erreur Redis", err);
  });
  await client.connect();
  return client;
}
