import { createServer } from "node:http";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { migrate } from "./db/migrate.js";
import { createPool } from "./db/pool.js";

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);

const applied = await migrate(pool);
if (applied.length > 0) {
  console.log(`Migrations appliquées : ${applied.join(", ")}`);
}

const server = createServer(createApp());

server.listen(config.PORT, () => {
  console.log(`API à l'écoute sur le port ${config.PORT}`);
});

function shutdown(): void {
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
