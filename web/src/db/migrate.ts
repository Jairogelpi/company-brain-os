/**
 * Auto-migrations: run Drizzle migrations on app startup.
 *
 * Usage:
 *   npx tsx src/db/migrate.ts
 *
 * Reads DATABASE_URL from env (defaults to local Postgres).
 * Applies all pending migrations automatically.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	(process.env.NODE_ENV === "production"
		? (() => {
				throw new Error("DATABASE_URL is required in production.");
			})()
		: "postgres://postgres:postgres@localhost:5432/company_brain_os");

export async function runMigrations() {
	const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
	const db = drizzle(pool);

	console.log(
		`Running migrations on ${DATABASE_URL.split("@")[1] ?? "localhost"}...`,
	);

	try {
		await migrate(db, { migrationsFolder: "./drizzle" });
		console.log("Migrations complete.");
	} catch (error) {
		console.error("Migration failed:", (error as Error).message);
		throw error;
	} finally {
		await pool.end();
	}
}

// Run directly if called as a script (ESM-safe; project is "type": "module")
if (process.argv[1]?.includes("migrate")) {
	runMigrations()
		.then(() => process.exit(0))
		.catch(() => process.exit(1));
}
