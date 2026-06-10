import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "./pool";
import { logger } from "../logging/logger";

const migrationsDir = path.join(process.cwd(), "src/infrastructure/database/migrations");

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    const alreadyApplied = await db.query("SELECT id FROM schema_migrations WHERE id = $1", [file]);
    if (alreadyApplied.rowCount) {
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await db.query("BEGIN");
    try {
      await db.query(sql);
      await db.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      await db.query("COMMIT");
      logger.info({ migration: file }, "Applied database migration");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  }
}

migrate()
  .then(async () => {
    await db.end();
  })
  .catch(async (error) => {
    logger.error({ error }, "Database migration failed");
    await db.end().catch(() => undefined);
    process.exit(1);
  });
