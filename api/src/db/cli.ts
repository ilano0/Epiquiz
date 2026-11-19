import { loadConfig } from "../config/env.js";
import { migrate } from "./migrate.js";
import { createPool } from "./pool.js";

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);

try {
  const applied = await migrate(pool);
  console.log(applied.length > 0 ? `Migrations appliquées : ${applied.join(", ")}` : "Base à jour");
} finally {
  await pool.end();
}
