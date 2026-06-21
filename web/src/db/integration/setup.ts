import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";
import { Pool } from "pg";
import { describe } from "vitest";
import * as schema from "@/db/schema";

const execFileAsync = promisify(execFile);

export type IntegrationDb = {
	url: string;
	db: ReturnType<typeof drizzle<typeof schema>>;
	stop: () => Promise<void>;
	ageAvailable: boolean;
	ageSkipReason: string | null;
};

export const integrationSkipReason =
	process.env.TESTCONTAINERS === "1" ? null : "TESTCONTAINERS=1 is not set";

export function shouldRunIntegration(): boolean {
	return process.env.TESTCONTAINERS === "1";
}

export const describeIntegration = shouldRunIntegration()
	? describe
	: describe.skip;

async function migrate(url: string): Promise<void> {
	await execFileAsync("npx", ["drizzle-kit", "push", "--force"], {
		cwd: process.cwd(),
		env: { ...process.env, DATABASE_URL: url },
	});
}

async function initExtensions(
	pool: Pool,
): Promise<{ ageAvailable: boolean; ageSkipReason: string | null }> {
	await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
	try {
		await pool.query("CREATE EXTENSION IF NOT EXISTS age");
		await pool.query("LOAD 'age'");
		return { ageAvailable: true, ageSkipReason: null };
	} catch (error) {
		return {
			ageAvailable: false,
			ageSkipReason: `AGE unavailable: ${(error as Error).message}`,
		};
	}
}

export async function startIntegrationDb(): Promise<IntegrationDb> {
	if (!shouldRunIntegration()) {
		throw new Error(integrationSkipReason ?? "Integration tests disabled");
	}
	await access(process.cwd());
	const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
		"pgvector/pgvector:pg16",
	).start();
	const url = container.getConnectionUri();
	const pool = new Pool({ connectionString: url, max: 5 });
	const extensions = await initExtensions(pool);
	await pool.end();
	await migrate(url);
	const testPool = new Pool({ connectionString: url, max: 5 });
	const db = drizzle(testPool, { schema });
	return {
		url,
		db,
		ageAvailable: extensions.ageAvailable,
		ageSkipReason: extensions.ageSkipReason,
		stop: async () => {
			await testPool.end();
			await container.stop();
		},
	};
}
