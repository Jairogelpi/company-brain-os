/**
 * pgvector-backed vector store for PostgreSQL.
 *
 * Requires the pgvector extension (already installed).
 * Falls back to in-memory VectorStore if DB is unavailable.
 *
 * Multi-tenant isolation: DB-backed embeddings carry `company_id`, are covered
 * by RLS, and are accessed only inside a tenant transaction. The nodes join is
 * retained for metadata and the caller performs a second tenant check.
 */

import { sql } from "drizzle-orm";
import {
	VectorStore,
	cosineSimilarity,
	type SearchResult,
} from "./vector-store";
import { nodeEmbeddings } from "@/db/schema";
import type { Db } from "@/db/index";
import { requireOrganizationId } from "@/auth/organization-context";
import { withTenantTransaction } from "@/db/tenant-transaction";

export interface PgVectorStore {
	upsert(
		id: string,
		vector: number[],
		metadata?: Record<string, unknown>,
		companyId?: string,
	): Promise<void>;
	delete(id: string, companyId?: string): Promise<void>;
	search(
		queryVector: number[],
		topK?: number,
		companyId?: string,
	): Promise<SearchResult[]>;
	clear(companyId?: string): Promise<void>;
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
		async upsert(id, vector, _metadata, companyId) {
			assertDimension(vector);
			const tenantId = requireOrganizationId(companyId);
			await withTenantTransaction(db, tenantId, (tx) => tx
				.insert(nodeEmbeddings)
				.values({
					nodeId: id,
					companyId: tenantId,
					embedding: vector,
				})
				.onConflictDoUpdate({
					target: nodeEmbeddings.nodeId,
					set: { embedding: vector, companyId: tenantId },
				}));
		},

		async delete(id, companyId) {
			const tenantId = requireOrganizationId(companyId);
			await withTenantTransaction(db, tenantId, (tx) => tx
				.delete(nodeEmbeddings)
				.where(sql`${nodeEmbeddings.nodeId} = ${id} AND ${nodeEmbeddings.companyId} = ${tenantId}`));
		},

		async search(queryVector, topK = DEFAULT_TOP_K, companyId) {
			const tenantId = requireOrganizationId(companyId);
			const lit = toVectorLiteral(queryVector);
			const overFetch = topK * 4;

			// pgvector cosine similarity query with multi-tenant join.
			// `<=>` is cosine distance; similarity = 1 - distance.
			// Over-fetch `topK * 4` inside SQL, then the caller (retrieve.ts)
			// slices to `topK` after the JS-side tenant filter.
			const rows = await withTenantTransaction(db, tenantId, (tx) => tx.execute(
				sql`SELECT ne.node_id AS node_id,
						1 - (ne.embedding <=> ${lit}::vector) AS similarity,
						n.name AS name,
						n.type AS type
					FROM node_embeddings ne
					JOIN nodes n ON n.id = ne.node_id AND n.company_id = ne.company_id
					WHERE ne.company_id = ${tenantId}
					ORDER BY ne.embedding <=> ${lit}::vector
					LIMIT ${overFetch}`,
			));

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

		async clear(companyId) {
			const tenantId = requireOrganizationId(companyId);
			await withTenantTransaction(db, tenantId, (tx) => tx
				.delete(nodeEmbeddings)
				.where(sql`${nodeEmbeddings.companyId} = ${tenantId}`));
		},
	};
}

// Re-exported for callers that build their own similarity scores.
export { cosineSimilarity };
