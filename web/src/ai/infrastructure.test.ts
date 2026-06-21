import { describe, expect, it } from "vitest";
import { embed, embedBatch, checkOllama } from "./embeddings";
import { cosineSimilarity } from "./vector-store";

describe("Embeddings (Ollama + fallback)", () => {
	it("produces a 768-dimensional vector", async () => {
		const vec = await embed("configurar llenadora");
		expect(vec.length).toBe(768);
		expect(vec.every((v) => typeof v === "number")).toBe(true);
	});

	it("produces similar vectors for similar text", async () => {
		const a = await embed("configurar llenadora");
		const b = await embed("configurar la llenadora crítica");

		const sim = cosineSimilarity(a, b);
		expect(sim).toBeGreaterThan(0.5);
	});

	it("produces different vectors for different text", async () => {
		const a = await embed("seguridad industrial");
		const b = await embed("configurar llenadora");

		const sim = cosineSimilarity(a, b);
		expect(sim).toBeLessThan(0.6);
	});

	it("embedBatch processes multiple texts", async () => {
		const vecs = await embedBatch([
			"Pedro",
			"configurar llenadora",
			"seguridad",
		]);

		expect(vecs).toHaveLength(3);
		for (const v of vecs) {
			expect(v.length).toBe(768);
		}
	}, 30000);

	it("checkOllama returns boolean", async () => {
		const available = await checkOllama();
		expect(typeof available).toBe("boolean");
	});
});

describe("OCR pipeline", () => {
	// OCR tests require files on disk — skip in unit test suite.
	// Integration tests would use real uploaded files.

	it("processFile module can be imported", async () => {
		const { processFile } = await import("./ocr-pipeline");
		expect(typeof processFile).toBe("function");
	});
});

describe("pgvector extension", () => {
	// pgvector is installed on the Docker container.
	// This test verifies the schema supports the vector type.

	it("node_embeddings table exists in schema", async () => {
		const { nodeEmbeddings } = await import("@/db/schema");
		expect(nodeEmbeddings).toBeDefined();
	});
});
