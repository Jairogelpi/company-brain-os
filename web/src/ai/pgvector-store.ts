/**
 * pgvector-backed vector store for PostgreSQL.
 *
 * Requires the pgvector extension (already installed).
 * Falls back to in-memory VectorStore if DB is unavailable.
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
	search(queryVector: number[], topK?: number): Promise<SearchResult[]>;
	clear(): Promise<void>;
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
				fallback.upsert(id, vector, metadata);
			},
			async delete(id) {
				fallback.delete(id);
			},
			async search(queryVector, topK = 5) {
				return fallback.search(queryVector, topK);
			},
			async clear() {
				fallback.clear();
			},
		};
	}

	return {
		async upsert(id, vector, metadata) {
			const vectorStr = JSON.stringify(vector);
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

		async search(queryVector, topK = 5) {
			const vectorStr = JSON.stringify(queryVector);

			// pgvector cosine similarity query
			// Uses pgvector's <=> operator for cosine distance
			const rows = await db.execute(
				sql`SELECT node_id, embedding, 1 - (embedding <=> ${vectorStr}::vector) AS similarity
					FROM node_embeddings
					ORDER BY embedding <=> ${vectorStr}::vector
					LIMIT ${topK}`,
			);

			const results: SearchResult[] = [];
			for (const row of rows.rows as Array<Record<string, unknown>>) {
				results.push({
					id: row.node_id as string,
					score: row.similarity as number,
					metadata: {},
				});
			}

			return results;
		},

		async clear() {
			await db.delete(nodeEmbeddings);
		},
	};
}
