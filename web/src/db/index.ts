import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Creates a Drizzle database instance connected to PostgreSQL.
 * Uses DATABASE_URL env var or the default local dev connection.
 */
const LOCAL_DEV_URL = "postgres://postgres:postgres@localhost:5432/company_brain_os";

function resolveConnectionString(url?: string): string {
	if (url) return url;
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	// Never silently fall back to default credentials in production.
	if (process.env.NODE_ENV === "production") {
		throw new Error("DATABASE_URL is required in production.");
	}
	return LOCAL_DEV_URL;
}

export function createDb(url?: string) {
	if (url) {
		return drizzle(new Pool({ connectionString: resolveConnectionString(url), max: 5 }), { schema });
	}
	return (defaultDb ??= drizzle(
		new Pool({
			connectionString: resolveConnectionString(),
			max: Math.max(1, Number(process.env.DATABASE_POOL_SIZE) || 10),
			application_name: "company-brain-os",
		}),
		{ schema },
	));
}

let defaultDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

export type Db = ReturnType<typeof createDb>;
export { schema };
