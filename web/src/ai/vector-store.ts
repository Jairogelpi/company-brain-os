/**
 * In-memory vector store with cosine similarity search.
 * Production replacement: pgvector extension in PostgreSQL.
 *
 * Vectors are stored as number[] and searched via cosine similarity.
 * This is zero-dependency and works immediately without Docker changes.
 */

export interface VectorEntry {
	id: string;
	vector: number[];
	metadata: Record<string, unknown>;
}

export interface SearchResult {
	id: string;
	score: number; // cosine similarity, 0-1 (higher = more similar)
	metadata: Record<string, unknown>;
}

export class VectorStore {
	private entries: Map<string, VectorEntry> = new Map();

	/**
	 * Add or update a vector entry.
	 */
	upsert(
		id: string,
		vector: number[],
		metadata?: Record<string, unknown>,
	): void {
		this.entries.set(id, { id, vector, metadata: metadata ?? {} });
	}

	/**
	 * Remove a vector entry.
	 */
	delete(id: string): void {
		this.entries.delete(id);
	}

	/**
	 * Get all entries.
	 */
	list(): VectorEntry[] {
		return [...this.entries.values()];
	}

	/**
	 * Search for the top-K most similar vectors using cosine similarity.
	 * Returns results sorted by descending similarity score.
	 */
	search(queryVector: number[], topK: number = 5): SearchResult[] {
		const results: SearchResult[] = [];

		for (const entry of this.entries.values()) {
			const score = cosineSimilarity(queryVector, entry.vector);
			results.push({
				id: entry.id,
				score,
				metadata: entry.metadata,
			});
		}

		// Sort by score descending (higher = more similar)
		results.sort((a, b) => b.score - a.score);
		return results.slice(0, topK);
	}

	/**
	 * Number of entries in the store.
	 */
	get size(): number {
		return this.entries.size;
	}

	/**
	 * Clear all entries.
	 */
	clear(): void {
		this.entries.clear();
	}
}

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between 0 and 1 (inclusive).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length || a.length === 0) return 0;

	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	const denominator = Math.sqrt(normA) * Math.sqrt(normB);
	if (denominator === 0) return 0;

	return dotProduct / denominator;
}

/**
 * Simple text embedding using character n-gram frequencies.
 * This is a deterministic, zero-dependency fallback.
 *
 * In production, replace with a real embedding model (OpenAI text-embedding-3-small,
 * Cohere embed-v3, or a local model via Ollama).
 */
export function simpleEmbed(text: string, dimensions: number = 128): number[] {
	const normalized = text
		.toLowerCase()
		.replace(/[^a-záéíóúñ0-9\s]/g, " ")
		.trim();
	if (!normalized) return new Array(dimensions).fill(0);

	const vector = new Array(dimensions).fill(0);

	// Character trigram hashing into vector dimensions
	for (let i = 0; i < normalized.length - 2; i++) {
		const trigram = normalized.slice(i, i + 3);
		const hash = hashString(trigram) % dimensions;
		vector[hash] += 1;
	}

	// Word-level features
	const words = normalized.split(/\s+/).filter((w) => w.length > 1);
	for (const word of words) {
		const hash = hashString(word) % dimensions;
		vector[hash] += 0.5;
	}

	// Normalize to unit length
	const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
	if (magnitude > 0) {
		for (let i = 0; i < dimensions; i++) {
			vector[i] /= magnitude;
		}
	}

	return vector;
}

function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	return Math.abs(hash);
}
