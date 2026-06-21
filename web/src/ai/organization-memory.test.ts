import { describe, expect, it } from "vitest";
import { VectorStore, cosineSimilarity, simpleEmbed } from "./vector-store";
import { OrganizationMemory } from "./organization-memory";
import type { GraphNode, KnowledgeNode, GraphEdge } from "@/domain/graph";

// --- Vector Store Tests ---

describe("VectorStore", () => {
	it("stores and retrieves vectors", () => {
		const store = new VectorStore();
		store.upsert("a", [1, 0, 0]);
		store.upsert("b", [0, 1, 0]);

		expect(store.size).toBe(2);
		const entries = store.list();
		expect(entries).toHaveLength(2);
	});

	it("upserts replace existing entries", () => {
		const store = new VectorStore();
		store.upsert("a", [1, 0, 0]);
		store.upsert("a", [0, 0, 1]);

		expect(store.size).toBe(1);
		expect(store.list()[0].vector).toEqual([0, 0, 1]);
	});

	it("deletes entries", () => {
		const store = new VectorStore();
		store.upsert("a", [1, 0, 0]);
		store.delete("a");
		expect(store.size).toBe(0);
	});

	it("searches by cosine similarity and returns top-K", () => {
		const store = new VectorStore();
		store.upsert("a", [1, 0, 0]);
		store.upsert("b", [0, 1, 0]);
		store.upsert("c", [0.7, 0.3, 0]);

		const results = store.search([1, 0, 0], 2);
		expect(results).toHaveLength(2);
		// "a" should be most similar to [1,0,0]
		expect(results[0].id).toBe("a");
		expect(results[0].score).toBeGreaterThan(results[1].score);
	});

	it("clears all entries", () => {
		const store = new VectorStore();
		store.upsert("a", [1, 0]);
		store.upsert("b", [0, 1]);
		store.clear();
		expect(store.size).toBe(0);
	});
});

describe("cosineSimilarity", () => {
	it("identical vectors have similarity 1", () => {
		expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
	});

	it("orthogonal vectors have similarity 0", () => {
		expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
	});

	it("opposite vectors have similarity -1", () => {
		expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
	});

	it("different-length vectors return 0", () => {
		expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
	});

	it("zero vectors return 0", () => {
		expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
	});
});

describe("simpleEmbed", () => {
	it("produces a vector of the requested dimension", () => {
		const vec = simpleEmbed("configurar llenadora", 128);
		expect(vec).toHaveLength(128);
	});

	it("produces similar vectors for similar text", () => {
		const a = simpleEmbed("configurar llenadora", 64);
		const b = simpleEmbed("configurar la llenadora", 64);
		const sim = cosineSimilarity(a, b);
		expect(sim).toBeGreaterThan(0.5);
	});

	it("produces different vectors for different text", () => {
		const a = simpleEmbed("seguridad", 64);
		const b = simpleEmbed("configurar llenadora", 64);
		const sim = cosineSimilarity(a, b);
		expect(sim).toBeLessThan(0.5);
	});

	it("handles empty text", () => {
		const vec = simpleEmbed("", 16);
		expect(vec.every((v) => v === 0)).toBe(true);
	});

	it("normalizes vectors to unit length", () => {
		const vec = simpleEmbed("un texto de prueba", 32);
		const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
		expect(mag).toBeCloseTo(1, 2);
	});
});

// --- Organization Memory Tests ---

const pedro: GraphNode = { id: "pedro", type: "Person", name: "Pedro" };
const laura: GraphNode = { id: "laura", type: "Person", name: "Laura" };
const fillerKnowledge: KnowledgeNode = {
	id: "k-filler",
	type: "Knowledge",
	name: "configurar llenadora",
	knowledgeType: "technical",
	documented: false,
	validationState: "proposed",
	confidence: 25,
	criticality: "high",
};
const safetyKnowledge: KnowledgeNode = {
	id: "k-safety",
	type: "Knowledge",
	name: "protocolo de seguridad",
	knowledgeType: "process",
	documented: true,
	validationState: "validated",
	confidence: 90,
	criticality: "high",
};

const masteryPedro: GraphEdge = {
	id: "e-m-p-f",
	type: "MASTERS",
	fromNodeId: pedro.id,
	toNodeId: fillerKnowledge.id,
	attributes: { level: 5 },
};

describe("OrganizationMemory", () => {
	it("indexes nodes and edges into the vector store", () => {
		const mem = new OrganizationMemory();
		mem.index([pedro, fillerKnowledge], [masteryPedro]);

		const results = mem.search("llenadora", 3);
		expect(results.length).toBeGreaterThanOrEqual(1);
		const ids = results.map((r) => r.id);
		expect(ids).toContain(fillerKnowledge.id);
	});

	it("finds the right person for a person query", () => {
		const mem = new OrganizationMemory();
		mem.index([pedro, fillerKnowledge], [masteryPedro]);

		const results = mem.search("Pedro", 2);
		expect(results[0].metadata.nodeName).toBe("Pedro");
	});

	it("answers who questions from indexed memory", async () => {
		const mem = new OrganizationMemory();
		mem.index([pedro, fillerKnowledge], [masteryPedro]);

		const result = await mem.answer("¿Quién configura la llenadora?");
		expect(result.answer).toContain("Pedro");
		expect(result.sources.length).toBeGreaterThan(0);
	});

	it("answers risk questions", async () => {
		const mem = new OrganizationMemory();
		mem.index([pedro, fillerKnowledge], [masteryPedro]);

		const result = await mem.answer("¿Qué riesgo hay?");
		expect(result.answer).toContain("riesgos");
	});

	it("answers documentation questions", async () => {
		const mem = new OrganizationMemory();
		mem.index([pedro, fillerKnowledge, safetyKnowledge], [masteryPedro]);

		const result = await mem.answer("¿Configurar llenadora está documentado?");
		expect(result.answer).toBeDefined();
	});

	it("answers metric questions", async () => {
		const mem = new OrganizationMemory();
		mem.index([pedro, fillerKnowledge], [masteryPedro]);

		const result = await mem.answer("¿Cuál es la salud organizacional?");
		expect(result.answer).toContain("Salud");
	});

	it("returns empty answer when nothing is indexed", async () => {
		const mem = new OrganizationMemory();
		const result = await mem.answer("¿Quién sabe?");
		expect(result.answer).toContain("No tengo información");
		expect(result.sources).toHaveLength(0);
	});

	it("provides sources with relevance scores", async () => {
		const mem = new OrganizationMemory();
		mem.index([pedro, laura, fillerKnowledge], [masteryPedro]);

		const result = await mem.answer("Pedro");
		expect(result.sources.length).toBeGreaterThan(0);
		for (const s of result.sources) {
			expect(s.relevance).toBeGreaterThanOrEqual(0);
			expect(s.relevance).toBeLessThanOrEqual(1);
			expect(s.nodeType).toBeDefined();
		}
	});
});
