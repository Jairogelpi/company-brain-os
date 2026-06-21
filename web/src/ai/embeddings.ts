/**
 * Ollama embeddings client — free, local, production-quality.
 * Uses nomic-embed-text (274 MB) which produces 768-dimensional vectors.
 *
 * Falls back to simpleEmbed if Ollama is unavailable.
 */

import { simpleEmbed } from "./vector-store";

const OLLAMA_URL = "http://localhost:11434/api/embeddings";
const OLLAMA_MODEL = "nomic-embed-text";
const EMBEDDING_DIMENSIONS = 768;

let ollamaAvailable: boolean | null = null;

/**
 * Check if Ollama is reachable.
 */
export async function checkOllama(): Promise<boolean> {
	if (ollamaAvailable !== null) return ollamaAvailable;

	try {
		const response = await fetch(
			`${OLLAMA_URL.replace("/api/embeddings", "")}/api/tags`,
			{
				signal: AbortSignal.timeout(3000),
			},
		);
		ollamaAvailable = response.ok;
	} catch {
		ollamaAvailable = false;
	}

	return ollamaAvailable;
}

/**
 * Generate embeddings using Ollama.
 * Falls back to simpleEmbed if Ollama is down.
 */
export async function embed(text: string): Promise<number[]> {
	const available = await checkOllama();
	if (!available) return simpleEmbed(text, EMBEDDING_DIMENSIONS);

	try {
		const response = await fetch(OLLAMA_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model: OLLAMA_MODEL, prompt: text }),
			signal: AbortSignal.timeout(15000),
		});

		if (!response.ok) throw new Error(`Ollama error ${response.status}`);

		const data = (await response.json()) as { embedding?: number[] };
		if (!data.embedding || data.embedding.length === 0) {
			throw new Error("Empty embedding from Ollama");
		}

		return data.embedding;
	} catch {
		// Fallback to simple embedding
		return simpleEmbed(text, EMBEDDING_DIMENSIONS);
	}
}

/**
 * Generate embeddings for multiple texts in parallel.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
	return Promise.all(texts.map((t) => embed(t)));
}
