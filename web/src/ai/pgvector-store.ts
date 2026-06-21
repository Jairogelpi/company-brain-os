/**
 * pgvector-backed vector store for PostgreSQL.
 *
 * Requires the pgvector extension (already installed).
 * Falls back to in-memory VectorStore if DB is unavailable.
 *
 * Multi-tenant isolation: `node_embeddings` has no `company_id` column,
 * so retrieval joins to `nodes.company_id` and over-fetches `topK * 4`
 * candidates before the JS-side tenant filter slices to `topK`. The
 * in-memory fallback path has no SQL filter, so `search` on that path
 * returns all matches and the caller is expected to filter by tenant.
 */

import { sql } from "drizzle-orm";
import {
	VectorStore,
	cosineSimilarity,
	type SearchResult,
} from "./vector-store";
import { nodeEmbeddings } from "@/db/schema";
import type { Db } from "@/db/index";

export interface PgVectorStore {
	upsert(
		id: string,
		vector: number[],
		metadata?: Record<string, unknown>,
	): Promise<void>;
	delete(id: string): Promise<void>;
	search(
		queryVector: number[],
		topK?: number,
		companyId?: string,
	): Promise<SearchResult[]>;
	clear(): Promise<void>;
}

const EXPECTED_DIM = 768;

/**
 * Resolve the default topK from the `RAG_TOP_K` env var, validated to
 * `1..50`. Out-of-range or unparseable values fall back to `5` with a
 * warning. Resolved once at module load (design §3.4); tests re-resolve
 * via `vi.resetModules()` + dynamic `import()`.
 */
function resolveTopK(): number {
	const raw = process.env.RAG_TOP_K;
	if (raw === undefined || raw === "") return 5;
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1 || n > 50) {
		console.warn(`RAG_TOP_K="${raw}" out of range (1..50); falling back to 5`);
		return 5;
	}
	return n;
}

export const DEFAULT_TOP_K = resolveTopK();

/** Serialize a number[] to a pgvector bracketed-CSV literal: `[v1,v2,...]`. */
export function toVectorLiteral(v: number[]): string {
	return `[${v.join(",")}]`;
}

function assertDimension(vector: number[]): void {
	if (vector.length !== EXPECTED_DIM) {
		throw new Error(
			`PgVectorStore.upsert: expected ${EXPECTED_DIM}-dim vector, got ${vector.length}`,
		);
	}
}

function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 0;
	if (n < 0) return 0;
	if (n > 1) return 1;
	return n;
}

/**
 * Create a pgvector-backed store using Drizzle + raw SQL.
 * Falls back to in-memory store if db is not provided.
 */
export function createPgVectorStore(db?: Db): PgVectorStore {
	if (!db) {
		const fallback = new VectorStore();
		return {
			async upsert(id, vector, metadata) {
				assertDimension(vector);
				fallback.upsert(id, vector, metadata);
			},
			async delete(id) {
				fallback.delete(id);
			},
			async search(queryVector, topK = DEFAULT_TOP_K, _companyId) {
				return fallback.search(queryVector, topK);
			},
			async clear() {
				fallback.clear();
			},
		};
	}

	return {
		async upsert(id, vector) {
			assertDimension(vector);
			await db
				.insert(nodeEmbeddings)
				.values({
					nodeId: id,
					embedding: vector,
				})
				.onConflictDoUpdate({
					target: nodeEmbeddings.nodeId,
					set: { embedding: vector },
				});
		},

		async delete(id) {
			await db
				.delete(nodeEmbeddings)
				.where(sql`${nodeEmbeddings.nodeId} = ${id}`);
		},

		async search(queryVector, topK = DEFAULT_TOP_K, companyId) {
			const lit = toVectorLiteral(queryVector);
			const overFetch = topK * 4;

			// pgvector cosine similarity query with multi-tenant join.
			// `<=>` is cosine distance; similarity = 1 - distance.
			// Over-fetch `topK * 4` inside SQL, then the caller (retrieve.ts)
			// slices to `topK` after the JS-side tenant filter.
			const tenantClause = companyId
				? sql`JOIN nodes n ON n.id = ne.node_id WHERE n.company_id = ${companyId}`
				: sql``;

			const rows = await db.execute(
				sql`SELECT ne.node_id AS node_id,
						1 - (ne.embedding <=> ${lit}::vector) AS similarity,
						n.name AS name,
						n.type AS type
					FROM node_embeddings ne
					${tenantClause}
					ORDER BY ne.embedding <=> ${lit}::vector
					LIMIT ${overFetch}`,
			);

			const results: SearchResult[] = [];
			for (const row of rows.rows as Array<Record<string, unknown>>) {
				results.push({
					id: row.node_id as string,
					score: clamp01(row.similarity as number),
					metadata: {
						nodeName: row.name ?? undefined,
						nodeType: row.type ?? undefined,
					},
				});
			}

			return results;
		},

		async clear() {
			await db.delete(nodeEmbeddings);
		},
	};
}

// Re-exported for callers that build their own similarity scores.
export { cosineSimilarity };
