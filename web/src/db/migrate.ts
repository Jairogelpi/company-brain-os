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
import { canonicalizeLegacyGraphNodes } from "./canonicalize-legacy-graph";

const DATABASE_URL =
	process.env.DATABASE_URL ??
	(process.env.NODE_ENV === "production"
		? (() => {
				throw new Error("DATABASE_URL is required in production.");
			})()
		: "postgres://postgres:postgres@localhost:5432/company_brain_os");

function formatErrorChain(error: unknown): string {
	const lines: string[] = [];
	const seen = new Set<unknown>();
	let current: unknown = error;
	let depth = 0;

	while (current && !seen.has(current) && depth < 8) {
		seen.add(current);
		if (current instanceof Error) {
			lines.push(`${depth === 0 ? "error" : `cause[${depth}]`}: ${current.name}: ${current.message}`);
			const withCode = current as Error & { code?: string; detail?: string; hint?: string; cause?: unknown };
			if (withCode.code) lines.push(`  code: ${withCode.code}`);
			if (withCode.detail) lines.push(`  detail: ${withCode.detail}`);
			if (withCode.hint) lines.push(`  hint: ${withCode.hint}`);
			current = withCode.cause;
		} else {
			lines.push(`${depth === 0 ? "error" : `cause[${depth}]`}: ${String(current)}`);
			break;
		}
		depth += 1;
	}

	return lines.join("\n");
}

export async function runMigrations() {
	const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
	const db = drizzle(pool);

	console.log(
		`Running migrations on ${DATABASE_URL.split("@")[1] ?? "localhost"}...`,
	);

	try {
		await migrate(db, { migrationsFolder: "./drizzle" });
		await canonicalizeLegacyGraphNodes(db);
		console.log("Migrations complete.");
	} catch (error) {
		console.error("Migration failed:\n" + formatErrorChain(error));
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
