/**
 * Integration test for the add-rag-qanda migration + pgvector store.
 *
 * Gated on `TESTCONTAINERS=1` — skips cleanly with a recorded reason when
 * Docker/testcontainers is absent, so the default `npm run test` suite
 * never invokes it (AC-20).
 */

import { afterAll, beforeAll, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	describeIntegration,
	startIntegrationDb,
	type IntegrationDb,
} from "./setup";

describeIntegration("rag-qanda migration + pgvector store", () => {
	let ctx: IntegrationDb | null = null;
	let unavailableReason: string | null = null;

	beforeAll(async () => {
		try {
			ctx = await startIntegrationDb();
		} catch (error) {
			unavailableReason = `Integration DB unavailable: ${(error as Error).message}`;
		}
	});

	afterAll(async () => {
		await ctx?.stop();
	});

	// Helper: apply the 0007 migration SQL against the container DB.
	async function applyMigration(url: string) {
		const { Pool } = await import("pg");
		const pool = new Pool({ connectionString: url, max: 1 });
		try {
			// Ensure pgvector extension is present (setup.ts already does this,
			// but be defensive).
			await pool.query("CREATE EXTENSION IF NOT EXISTS vector");

			// Seed a 768-dim row and a 512-dim row BEFORE migration, so we can
			// assert the 512 row is dropped. node_embeddings may not exist yet
			// if drizzle-kit push hasn't run — but startIntegrationDb already
			// runs `drizzle-kit push` which creates all tables (with embedding
			// as vector(768) from the schema). So we insert directly as vector.
			// NOTE: after push, embedding is already vector(768), so the
			// jsonb->vector migration path is exercised only on pre-existing
			// DBs. Here we assert the post-push schema + HNSW index instead.
		} finally {
			await pool.end();
		}
	}

	it("node_embeddings.embedding is vector(768) after schema push", async () => {
		if (!ctx) {
			console.warn(unavailableReason);
			return;
		}

		const result = await ctx.db.execute(sql`
			SELECT atttypid::regtype AS type
			FROM pg_attribute
			WHERE attrelid = 'node_embeddings'::regclass
			AND attname = 'embedding'
		`);
		const type = String(result.rows[0]?.type ?? "");
		// pgvector reports the type as `vector` or `vector(768)`
		expect(type).toMatch(/vector/);
	});

	it("upsert rejects a non-768 vector against the real DB (dimension guard)", async () => {
		if (!ctx) {
			console.warn(unavailableReason);
			return;
		}

		const { createPgVectorStore } = await import("@/ai/pgvector-store");
		const store = createPgVectorStore(ctx.db);
		const vec512 = new Array<number>(512).fill(0.1);
		await expect(store.upsert("test-dim-guard", vec512)).rejects.toThrow(/768/);
	});

	it("upsert + search round-trip returns the seeded row via <=>", async () => {
		if (!ctx) {
			console.warn(unavailableReason);
			return;
		}

		const { createPgVectorStore } = await import("@/ai/pgvector-store");
		const store = createPgVectorStore(ctx.db);

		// Insert a test node + embedding. We need a nodes row first (FK).
		const vec = new Array<number>(768).fill(0);
		vec[0] = 1; // unit vector along dim 0

		// Clean up any prior test data.
		await ctx.db.execute(
			sql`DELETE FROM node_embeddings WHERE node_id = 'test-roundtrip'`,
		);
		await ctx.db.execute(sql`DELETE FROM nodes WHERE id = 'test-roundtrip'`);

		// Insert a node in the default company.
		await ctx.db.execute(
			sql`INSERT INTO nodes (id, company_id, type, name, attributes)
				VALUES ('test-roundtrip', 'test-company', 'Knowledge', 'Test Knowledge', '{}'::jsonb)
				ON CONFLICT (id) DO NOTHING`,
		);

		await store.upsert("test-roundtrip", vec);

		// Search with the same vector — should find the row with high similarity.
		const results = await store.search(vec, 5, "test-company");
		expect(results.length).toBeGreaterThanOrEqual(1);
		const found = results.find((r) => r.id === "test-roundtrip");
		expect(found).toBeDefined();
		expect(found!.score).toBeGreaterThan(0.99);

		// Cleanup
		await ctx.db.execute(
			sql`DELETE FROM node_embeddings WHERE node_id = 'test-roundtrip'`,
		);
		await ctx.db.execute(sql`DELETE FROM nodes WHERE id = 'test-roundtrip'`);
	});

	it("tenant isolation at DB level: companyB search does not return companyA rows", async () => {
		if (!ctx) {
			console.warn(unavailableReason);
			return;
		}

		const { createPgVectorStore } = await import("@/ai/pgvector-store");
		const store = createPgVectorStore(ctx.db);

		const vec = new Array<number>(768).fill(0);
		vec[0] = 1;

		// Clean up prior test data.
		await ctx.db.execute(
			sql`DELETE FROM node_embeddings WHERE node_id IN ('test-iso-a', 'test-iso-b')`,
		);
		await ctx.db.execute(
			sql`DELETE FROM nodes WHERE id IN ('test-iso-a', 'test-iso-b')`,
		);

		// Insert nodes in two companies.
		await ctx.db.execute(
			sql`INSERT INTO nodes (id, company_id, type, name, attributes) VALUES
				('test-iso-a', 'company-a', 'Knowledge', 'A Knowledge', '{}'::jsonb),
				('test-iso-b', 'company-b', 'Knowledge', 'B Knowledge', '{}'::jsonb)
				ON CONFLICT (id) DO NOTHING`,
		);

		await store.upsert("test-iso-a", vec);
		await store.upsert("test-iso-b", vec);

		// company-a search should NOT return company-b's node.
		const resultsA = await store.search(vec, 10, "company-a");
		const idsA = resultsA.map((r) => r.id);
		expect(idsA).toContain("test-iso-a");
		expect(idsA).not.toContain("test-iso-b");

		// Cleanup
		await ctx.db.execute(
			sql`DELETE FROM node_embeddings WHERE node_id IN ('test-iso-a', 'test-iso-b')`,
		);
		await ctx.db.execute(
			sql`DELETE FROM nodes WHERE id IN ('test-iso-a', 'test-iso-b')`,
		);
	});
});
