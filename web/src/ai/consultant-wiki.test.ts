import { describe, expect, it, vi } from "vitest";
import type { GraphNode, KnowledgeNode, GraphEdge } from "@/domain/graph";
import { runConsultant } from "@/ai/consultant";
import { generateWiki } from "@/ai/wiki-generator";

// --- Fixtures ---

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

const doughKnowledge: KnowledgeNode = {
	id: "k-dough",
	type: "Knowledge",
	name: "masa madre",
	knowledgeType: "technical",
	documented: true,
	validationState: "validated",
	confidence: 90,
	criticality: "high",
};

const signingKnowledge: KnowledgeNode = {
	id: "k-signing",
	type: "Knowledge",
	name: "criterio para firmar",
	knowledgeType: "rule",
	documented: false,
	validationState: "draft",
	confidence: 10,
	criticality: "high",
};

const masteryPedro: GraphEdge = {
	id: "e-m-p-f",
	type: "MASTERS",
	fromNodeId: pedro.id,
	toNodeId: fillerKnowledge.id,
	attributes: { level: 5 },
};

const masteryLaura: GraphEdge = {
	id: "e-m-l-s",
	type: "MASTERS",
	fromNodeId: laura.id,
	toNodeId: signingKnowledge.id,
	attributes: { level: 5 },
};

const learnsLaura: GraphEdge = {
	id: "e-l-l-f",
	type: "LEARNS",
	fromNodeId: laura.id,
	toNodeId: fillerKnowledge.id,
	attributes: { level: 2 },
};

describe("F12 — AI Organizational Consultant", () => {
	describe("runConsultant (heuristic fallback)", () => {
		it("generates recommendations without LLM configured", async () => {
			const report = await runConsultant(
				[pedro, fillerKnowledge, signingKnowledge],
				[masteryPedro, masteryLaura],
			);

			expect(report.recommendations.length).toBeGreaterThanOrEqual(1);
			expect(report.summary).toContain("recommendations");
			expect(report.modelUsed).toBe("heuristic");
		});

		it("prioritizes documentation for undocumented critical SPOF", async () => {
			const report = await runConsultant(
				[pedro, fillerKnowledge],
				[masteryPedro],
			);

			const docRecs = report.recommendations.filter(
				(r) => r.type === "document",
			);
			expect(docRecs.length).toBeGreaterThanOrEqual(1);
			expect(docRecs[0].priority).toBe("critical");
		});

		it("recommends training for close-to-expert learners", async () => {
			const report = await runConsultant(
				[pedro, laura, fillerKnowledge],
				[masteryPedro, learnsLaura],
			);

			const trainRecs = report.recommendations.filter(
				(r) => r.type === "train",
			);
			expect(trainRecs.length).toBeGreaterThanOrEqual(1);
			expect(trainRecs[0].message).toContain("Laura");
		});

		it("recommends validation for proposed/draft knowledge", async () => {
			const report = await runConsultant(
				[pedro, fillerKnowledge, signingKnowledge],
				[masteryPedro, masteryLaura],
			);

			const validateRecs = report.recommendations.filter(
				(r) => r.type === "validate",
			);
			expect(validateRecs.length).toBeGreaterThanOrEqual(1);
		});

		it("caps recommendations at 10", async () => {
			const nodes: GraphNode[] = [pedro];
			const edges: GraphEdge[] = [];
			// Generate many knowledge nodes
			for (let i = 0; i < 20; i++) {
				const k: KnowledgeNode = {
					id: `k-${i}`,
					type: "Knowledge",
					name: `knowledge ${i}`,
					knowledgeType: "technical",
					documented: false,
					validationState: "draft",
					confidence: 10,
					criticality: "high",
				};
				nodes.push(k);
			}

			const report = await runConsultant(nodes, edges);
			expect(report.recommendations.length).toBeLessThanOrEqual(10);
		});

		it("generates executive summary", async () => {
			const report = await runConsultant(
				[pedro, fillerKnowledge],
				[masteryPedro],
			);

			expect(report.summary.length).toBeGreaterThan(0);
			expect(report.generatedAt).toBeDefined();
		});
	});
});

describe("F12 — Wiki Generator", () => {
	describe("generateWiki", () => {
		it("generates a wiki page for each knowledge node", () => {
			const wiki = generateWiki(
				[pedro, fillerKnowledge, doughKnowledge],
				[masteryPedro],
			);

			expect(wiki.pages).toHaveLength(2);
		});

		it("includes bus factor, confidence, and documentation status", () => {
			const wiki = generateWiki([pedro, fillerKnowledge], [masteryPedro]);

			const page = wiki.pages[0];
			expect(page.content).toContain("Bus Factor");
			expect(page.content).toContain("Confidence");
			expect(page.content).toContain("Documented");
			expect(page.content).toContain("❌ No");
		});

		it("includes experts section with names", () => {
			const wiki = generateWiki([pedro, fillerKnowledge], [masteryPedro]);

			const page = wiki.pages[0];
			expect(page.content).toContain("Pedro");
		});

		it("generates a table of contents", () => {
			const wiki = generateWiki(
				[pedro, fillerKnowledge, doughKnowledge],
				[masteryPedro],
			);

			expect(wiki.tableOfContents).toContain("Living Wiki");
			expect(wiki.tableOfContents).toContain("configurar llenadora");
			expect(wiki.tableOfContents).toContain("masa madre");
		});

		it("shows relationships section", () => {
			const wiki = generateWiki([pedro, fillerKnowledge], [masteryPedro]);

			const page = wiki.pages[0];
			expect(page.content).toContain("Relationships");
			expect(page.content).toContain("MASTERS");
		});

		it("handles knowledge with no experts gracefully", () => {
			const wiki = generateWiki([fillerKnowledge], []);

			const page = wiki.pages[0];
			expect(page.content).toContain("Lost knowledge");
		});

		it("includes knowledge type and validation state for Knowledge nodes", () => {
			const wiki = generateWiki([pedro, fillerKnowledge], [masteryPedro]);

			const page = wiki.pages[0];
			expect(page.content).toContain("technical");
			expect(page.content).toContain("proposed");
		});
	});
});
