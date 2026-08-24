import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createDb } from "@/db";
import { checkDistributedRateLimit } from "./rate-limiter";

// Regression coverage for a real bug: the original SQL used two
// data-modifying CTEs (INSERT ... ON CONFLICT, then a separate UPDATE)
// targeting the same table. Postgres does not guarantee a later CTE in a
// statement observes a row written by an earlier CTE in that same
// statement, so the UPDATE silently matched zero rows — on every call, not
// just the first. That made checkDistributedRateLimit throw on every
// invocation, which /api/auth/register surfaced as a permanent
// "Signup temporarily unavailable" 503. The unit tests for the register
// route mock this function entirely, so only a real-Postgres test catches
// it. Skips automatically when no DATABASE_URL is configured (e.g. plain
// `npm test` locally without a DB).
const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("checkDistributedRateLimit (real Postgres)", () => {
	const db = createDb();
	const keys: string[] = [];

	afterAll(async () => {
		if (keys.length === 0) return;
		const { sql } = await import("drizzle-orm");
		const { createHash } = await import("node:crypto");
		for (const key of keys) {
			const keyHash = createHash("sha256").update(key).digest("hex");
			await db.execute(sql`delete from rate_limit_buckets where key_hash = ${keyHash}`);
		}
	});

	it("allows a brand-new key on its very first call", async () => {
		const key = `test:${randomUUID()}`;
		keys.push(key);

		const result = await checkDistributedRateLimit(key, 60, 3, db);

		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(2);
	});

	it("allows and decrements on the second call for an existing key (steady state)", async () => {
		const key = `test:${randomUUID()}`;
		keys.push(key);

		const first = await checkDistributedRateLimit(key, 60, 3, db);
		const second = await checkDistributedRateLimit(key, 60, 3, db);

		expect(first.allowed).toBe(true);
		expect(second.allowed).toBe(true);
		expect(second.remaining).toBe(1);
	});

	it("denies once capacity is exhausted", async () => {
		const key = `test:${randomUUID()}`;
		keys.push(key);

		await checkDistributedRateLimit(key, 60, 2, db);
		await checkDistributedRateLimit(key, 60, 2, db);
		const denied = await checkDistributedRateLimit(key, 60, 2, db);

		expect(denied.allowed).toBe(false);
		expect(denied.retryAfter).toBeGreaterThan(0);
	});
});
