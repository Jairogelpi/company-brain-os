import { describe, expect, it } from "vitest";
import type { GraphNode, KnowledgeNode, GraphEdge } from "./graph";
import {
	extractGenome,
	generateGenomeReport,
	computeGenomeHealth,
} from "./genome";

const pedro: GraphNode = { id: "pedro", type: "Person", name: "Pedro" };
const laura: GraphNode = { id: "laura", type: "Person", name: "Laura" };

const noMuestraRule: KnowledgeNode = {
	id: "k-rule-1",
	type: "Knowledge",
	name: "no dar muestra sin pago",
	knowledgeType: "rule",
	documented: false,
	validationState: "proposed",
	confidence: 30,
	criticality: "medium",
};

const siempreCotizarPolicy: KnowledgeNode = {
	id: "k-policy-1",
	type: "Knowledge",
	name: "siempre pedir tres cotizaciones",
	knowledgeType: "policy",
	documented: false,
	validationState: "draft",
	confidence: 20,
	criticality: "low",
};

const respetoValue: KnowledgeNode = {
	id: "k-value-1",
	type: "Knowledge",
	name: "el cliente siempre tiene razón",
	knowledgeType: "value",
	documented: true,
	validationState: "validated",
	confidence: 80,
	criticality: "medium",
};

const masteryRule: GraphEdge = {
	id: "e-m-p-r1",
	type: "MASTERS",
	fromNodeId: pedro.id,
	toNodeId: noMuestraRule.id,
	attributes: { level: 4 },
};

const masteryPolicy: GraphEdge = {
	id: "e-m-l-p1",
	type: "MASTERS",
	fromNodeId: laura.id,
	toNodeId: siempreCotizarPolicy.id,
	attributes: { level: 3 },
};

const masteryValue1: GraphEdge = {
	id: "e-m-p-v1",
	type: "MASTERS",
	fromNodeId: pedro.id,
	toNodeId: respetoValue.id,
	attributes: { level: 5 },
};

const masteryValue2: GraphEdge = {
	id: "e-m-l-v1",
	type: "MASTERS",
	fromNodeId: laura.id,
	toNodeId: respetoValue.id,
	attributes: { level: 4 },
};

describe("Company Genome", () => {
	describe("extractGenome", () => {
		it("extracts only rule, value, and policy knowledge nodes", () => {
			const genome = extractGenome(
				[pedro, laura, noMuestraRule, siempreCotizarPolicy, respetoValue],
				[masteryRule, masteryPolicy, masteryValue1, masteryValue2],
			);

			expect(genome).toHaveLength(3);
			expect(genome.map((e) => e.category)).toContain("rule");
			expect(genome.map((e) => e.category)).toContain("policy");
			expect(genome.map((e) => e.category)).toContain("value");
		});

		it("calculates bus factor for each genome entry", () => {
			const genome = extractGenome(
				[pedro, laura, noMuestraRule],
				[masteryRule],
			);

			expect(genome[0].busFactor).toBe(1);
			expect(genome[0].expertNames).toContain("Pedro");
		});

		it("includes description with experts and documentation status", () => {
			const genome = extractGenome([pedro, noMuestraRule], [masteryRule]);

			expect(genome[0].description).toContain("Only Pedro");
			expect(genome[0].description).toContain("Not documented");
		});

		it("returns empty array when no genome nodes exist", () => {
			const fillerKnowledge: KnowledgeNode = {
				id: "k-tech",
				type: "Knowledge",
				name: "configurar llenadora",
				knowledgeType: "technical",
				documented: false,
				validationState: "proposed",
				confidence: 25,
				criticality: "high",
			};

			const genome = extractGenome([pedro, fillerKnowledge], []);
			expect(genome).toHaveLength(0);
		});
	});

	describe("generateGenomeReport", () => {
		it("generates summary with category counts", () => {
			const report = generateGenomeReport(
				[pedro, laura, noMuestraRule, siempreCotizarPolicy, respetoValue],
				[masteryRule, masteryPolicy, masteryValue1, masteryValue2],
			);

			expect(report.summary.totalRules).toBe(1);
			expect(report.summary.totalPolicies).toBe(1);
			expect(report.summary.totalValues).toBe(1);
		});

		it("counts at-risk entries (bus factor ≤ 1 and undocumented)", () => {
			const report = generateGenomeReport(
				[pedro, noMuestraRule, siempreCotizarPolicy],
				[masteryRule, masteryPolicy],
			);

			// Both are undocumented, bus factor 1 each → both at risk
			expect(report.summary.atRisk).toBe(2);
		});

		it("does not flag documented entries as at-risk even with bus factor 1", () => {
			const documentedRule: KnowledgeNode = {
				...noMuestraRule,
				documented: true,
			};

			const report = generateGenomeReport(
				[pedro, documentedRule],
				[masteryRule],
			);

			expect(report.summary.atRisk).toBe(0);
		});
	});

	describe("computeGenomeHealth", () => {
		it("returns 100 when no genome entries exist", () => {
			const health = computeGenomeHealth([pedro], []);
			expect(health.score).toBe(100);
		});

		it("returns lower score when entries are undocumented and at risk", () => {
			const health = computeGenomeHealth(
				[pedro, noMuestraRule, siempreCotizarPolicy],
				[masteryRule, masteryPolicy],
			);

			expect(health.score).toBeLessThan(70);
			expect(health.breakdown.length).toBeGreaterThan(0);
		});

		it("returns high score for well-documented multi-expert genome", () => {
			const health = computeGenomeHealth(
				[pedro, laura, respetoValue],
				[masteryValue1, masteryValue2],
			);

			expect(health.score).toBeGreaterThanOrEqual(70);
		});
	});
});
