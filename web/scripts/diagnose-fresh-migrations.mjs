import { readMigrationFiles } from "drizzle-orm/migrator";
import pg from "pg";

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/company_brain_os";
const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
const client = await pool.connect();

function tagFor(index) {
  return String(index).padStart(4, "0");
}

try {
  await client.query("BEGIN");
  for (let i = 0; i < migrations.length; i += 1) {
    const migration = migrations[i];
    if (i === 23) {
      const before = await client.query(`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'node_embeddings'
        ORDER BY ordinal_position
      `);
      console.log("STATE BEFORE 0023", before.rows);
    }

    console.log(`MIGRATION ${tagFor(i)} millis=${migration.folderMillis} statements=${migration.sql.length}`);

    for (let j = 0; j < migration.sql.length; j += 1) {
      const statement = migration.sql[j].trim();
      if (!statement) continue;
      if (i === 23) {
        const state = await client.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'node_embeddings'
            AND column_name = 'company_id'
        `);
        console.log(`  0023 stmt ${j}: company_id exists before=${state.rowCount > 0}`);
      }
      try {
        await client.query(statement);
      } catch (error) {
        console.error(`FAILED migration=${i} statement=${j}`);
        console.error(statement.slice(0, 500));
        console.error({ message: error.message, code: error.code, detail: error.detail, hint: error.hint });
        throw error;
      }
    }
  }
  console.log("DIAGNOSTIC PASS: every migration executed once in order.");
} finally {
  try {
    await client.query("ROLLBACK");
  } catch {}
  client.release();
  await pool.end();
}
