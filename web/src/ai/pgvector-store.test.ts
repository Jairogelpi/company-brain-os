import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createPgVectorStore } from "./pgvector-store";

function vec768(): number[] {
	const v = new Array<number>(768);
	for (let i = 0; i < 768; i++) v[i] = (i % 13) / 31;
	return v;
}
function vec512(): number[] {
	const v = new Array<number>(512);
	for (let i = 0; i < 512; i++) v[i] = (i % 13) / 31;
	return v;
}

/** Serialize a Drizzle `SQL` template object into an approximate string for
 *  assertion: raw string chunks are joined, `Param` chunks render as their
 *  driver value, nested `SQL`/`SQLWrapper` chunks are recursed into. Good
 *  enough to assert on operator / keyword presence. */
function sqlToString(sqlObj: unknown): string {
	const chunks = (sqlObj as { queryChunks?: unknown[] }).queryChunks ?? [];
	const parts: string[] = [];
	for (const chunk of chunks) {
		if (chunk === null || chunk === undefined) continue;
		if (
			typeof chunk === "string" ||
			typeof chunk === "number" ||
			typeof chunk === "boolean"
		) {
			parts.push(String(chunk));
			continue;
		}
		if (typeof chunk === "bigint") {
			parts.push(String(chunk));
			continue;
		}
		const c = chunk as {
			value?: unknown;
			constructor?: { name?: string };
			queryChunks?: unknown[];
			getSQL?: () => unknown;
		};
		// Recurse into nested SQL chunks (a SQL object's queryChunks array).
		if (Array.isArray(c.queryChunks)) {
			parts.push(sqlToString(c));
			continue;
		}
		const ctor = c.constructor?.name;
		if (ctor === "StringChunk") {
			parts.push(
				Array.isArray(c.value)
					? (c.value as string[]).join("")
					: String(c.value),
			);
		} else if (ctor === "Param") {
			parts.push(String(c.value));
		} else {
			parts.push(String((c as { value?: unknown }).value ?? ""));
		}
	}
	return parts.join("");
}

/** Minimal mock Db capturing `insert` and `execute` calls. */
function mockDb() {
	type Row = Record<string, unknown>;
	const execute = vi.fn(async (_sqlObj: unknown): Promise<{ rows: Row[] }> => {
		// Return a shape Drizzle's execute resolves to: { rows: [] }.
		return { rows: [] };
	});
	const insert = vi.fn(() => ({
		values: vi.fn(() => ({
			onConflictDoUpdate: vi.fn(async () => undefined),
		})),
	}));
	const deleteFn = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
	const tx = { execute, insert, delete: deleteFn };
	const transaction = vi.fn(async (work: (inner: typeof tx) => Promise<unknown>) => work(tx));
	return { ...tx, transaction } as unknown as Parameters<
		typeof createPgVectorStore
	>[0] & {
		execute: typeof execute;
		insert: typeof insert;
		delete: typeof deleteFn;
		transaction: typeof transaction;
	};
}

describe("PgVectorStore — DB-backed path", () => {
	it("upsert rejects a non-768 vector with an error mentioning 768", async () => {
		const db = mockDb();
		const store = createPgVectorStore(db);
		await expect(store.upsert("n1", vec512(), undefined, "companyA")).rejects.toThrow(/768/);
		expect(db.insert).not.toHaveBeenCalled();
	});

	it("upsert accepts a 768 vector and calls db.insert", async () => {
		const db = mockDb();
		const store = createPgVectorStore(db);
		await store.upsert("n1", vec768(), undefined, "companyA");
		expect(db.insert).toHaveBeenCalled();
	});

	it("search issues a <=> cosine query with the nodes.company_id join and over-fetch LIMIT", async () => {
		const db = mockDb();
		const store = createPgVectorStore(db);
		await store.search(vec768(), 5, "companyA");

		expect(db.execute).toHaveBeenCalledTimes(2);
		const sqlText = sqlToString((db.execute.mock.calls.at(-1) as unknown[])[0]);
		// pgvector cosine distance operator
		expect(sqlText).toContain("<=>");
		// ORDER BY ... <=> ordering
		expect(sqlText.toLowerCase()).toMatch(/order by.*<=>/);
		// tenant join to nodes.company_id
		expect(sqlText.toLowerCase()).toContain("join nodes");
		expect(sqlText.toLowerCase()).toContain("company_id");
		// over-fetch LIMIT = topK * 4 = 20
		expect(sqlText).toContain("20");
	});

	it("search clamps score into [0,1] and maps rows to SearchResult[]", async () => {
		const db = mockDb();
		db.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
			rows: [
				{ node_id: "n1", similarity: 0.9, name: "Filler", type: "Knowledge" },
				{ node_id: "n2", similarity: -0.1, name: "Other", type: "Person" },
			],
		});
		const store = createPgVectorStore(db);
		const results = await store.search(vec768(), 5, "companyA");
		expect(results).toHaveLength(2);
		expect(results[0].id).toBe("n1");
		expect(results[0].score).toBeGreaterThanOrEqual(0);
		expect(results[0].score).toBeLessThanOrEqual(1);
		// negative similarity clamped to 0
		expect(results[1].score).toBe(0);
	});
});

describe("PgVectorStore — in-memory fallback path", () => {
	it("createPgVectorStore(undefined) returns a store that does not execute SQL", async () => {
		const store = createPgVectorStore(undefined);
		await store.upsert("n1", vec768());
		const results = await store.search(vec768(), 5);
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results[0].id).toBe("n1");
	});

	it("fallback upsert also rejects non-768 vectors (dim guard applies to both paths)", async () => {
		const store = createPgVectorStore(undefined);
		await expect(store.upsert("n1", vec512())).rejects.toThrow(/768/);
	});
});

describe("RAG_TOP_K resolution", () => {
	const original = process.env.RAG_TOP_K;

	beforeEach(() => {
		delete process.env.RAG_TOP_K;
	});

	afterEach(() => {
		if (original === undefined) delete process.env.RAG_TOP_K;
		else process.env.RAG_TOP_K = original;
	});

	it("defaults to 5 when RAG_TOP_K is unset", async () => {
		delete process.env.RAG_TOP_K;
		vi.resetModules();
		const mod = await import("./pgvector-store");
		expect(mod.DEFAULT_TOP_K).toBe(5);
	});

	it("uses RAG_TOP_K when in range 1..50", async () => {
		process.env.RAG_TOP_K = "12";
		vi.resetModules();
		const mod = await import("./pgvector-store");
		expect(mod.DEFAULT_TOP_K).toBe(12);
	});

	it("falls back to 5 with a warning when RAG_TOP_K is out of range", async () => {
		process.env.RAG_TOP_K = "999";
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.resetModules();
		const mod = await import("./pgvector-store");
		expect(mod.DEFAULT_TOP_K).toBe(5);
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});
});
