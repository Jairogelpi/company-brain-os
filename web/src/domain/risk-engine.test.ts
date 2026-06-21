import { describe, expect, it } from "vitest";
import type { GraphNode, KnowledgeNode, GraphEdge } from "./graph";
import {
	detectSinglePointOfFailure,
	detectBusFactorZero,
	detectUndocumentedCritical,
	detectLowResilience,
	detectAllRisks,
} from "./risk-engine";

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

const documentedKnowledge: KnowledgeNode = {
	id: "k-doc",
	type: "Knowledge",
	name: "protocolo de seguridad",
	knowledgeType: "process",
	documented: true,
	validationState: "validated",
	confidence: 85,
	criticality: "high",
};

const lostKnowledge: KnowledgeNode = {
	id: "k-lost",
	type: "Knowledge",
	name: "técnica de soldadura antigua",
	knowledgeType: "technical",
	documented: false,
	validationState: "retired",
	confidence: 5,
	criticality: "high",
};

const productionProcess: GraphNode = {
	id: "proc-prod",
	type: "Process",
	name: "Production",
	criticality: "high",
};

const masteryPedro: GraphEdge = {
	id: "e-m-p-f",
	type: "MASTERS",
	fromNodeId: pedro.id,
	toNodeId: fillerKnowledge.id,
	attributes: { level: 5 },
};

describe("Risk Engine", () => {
	describe("detectSinglePointOfFailure", () => {
		it("detects a single-point-of-failure risk for bus factor 1 critical knowledge", () => {
			const risks = detectSinglePointOfFailure(
				[pedro, fillerKnowledge],
				[masteryPedro],
			);

			expect(risks).toHaveLength(1);
			expect(risks[0].riskType).toBe("single_point_of_failure");
			expect(risks[0].sourceNodeId).toBe(fillerKnowledge.id);
			expect(risks[0].message).toContain("Pedro");
		});

		it("does NOT flag knowledge with bus factor ≥ 2", () => {
			const secondExpert: GraphEdge = {
				id: "e-m-l-f",
				type: "MASTERS",
				fromNodeId: laura.id,
				toNodeId: fillerKnowledge.id,
				attributes: { level: 4 },
			};

			const risks = detectSinglePointOfFailure(
				[pedro, laura, fillerKnowledge],
				[masteryPedro, secondExpert],
			);

			expect(risks).toHaveLength(0);
		});

		it("does NOT flag non-critical knowledge even with bus factor 1", () => {
			const nonCritical: KnowledgeNode = {
				...fillerKnowledge,
				criticality: "low",
			};
			const risks = detectSinglePointOfFailure(
				[pedro, nonCritical],
				[masteryPedro],
			);

			expect(risks).toHaveLength(0);
		});
	});

	describe("detectBusFactorZero", () => {
		it("detects lost knowledge (bus factor 0, critical)", () => {
			const risks = detectBusFactorZero(
				[lostKnowledge],
				[], // no experts
			);

			expect(risks).toHaveLength(1);
			expect(risks[0].riskType).toBe("bus_factor_zero");
			expect(risks[0].severity).toBe("critical");
		});
	});

	describe("detectUndocumentedCritical", () => {
		it("detects undocumented critical knowledge", () => {
			const risks = detectUndocumentedCritical([fillerKnowledge], []);

			expect(risks).toHaveLength(1);
			expect(risks[0].riskType).toBe("undocumented_critical");
		});

		it("does NOT flag documented critical knowledge", () => {
			const risks = detectUndocumentedCritical([documentedKnowledge], []);

			expect(risks).toHaveLength(0);
		});
	});

	describe("detectLowResilience", () => {
		it("detects process with low-resilience required knowledge", () => {
			const requiresEdge: GraphEdge = {
				id: "e-r-prod-f",
				type: "REQUIRES",
				fromNodeId: productionProcess.id,
				toNodeId: fillerKnowledge.id,
			};

			const risks = detectLowResilience(
				[pedro, fillerKnowledge, productionProcess],
				[masteryPedro, requiresEdge],
			);

			expect(risks.length).toBeGreaterThanOrEqual(1);
			expect(risks[0].riskType).toBe("low_resilience");
		});
	});

	describe("detectAllRisks", () => {
		it("produces a unified risk report with summary", () => {
			const report = detectAllRisks(
				[pedro, fillerKnowledge, documentedKnowledge, lostKnowledge],
				[masteryPedro],
			);

			expect(report.risks.length).toBeGreaterThanOrEqual(2);
			expect(report.summary.total).toBe(report.risks.length);
			expect(report.summary.critical).toBeGreaterThanOrEqual(0);
			expect(report.summary.averageConfidence).toBeGreaterThanOrEqual(0);
			expect(report.summary.averageConfidence).toBeLessThanOrEqual(100);
		});

		it("reports empty risk list for a fully documented multi-expert graph", () => {
			const secondExpert: GraphEdge = {
				id: "e-m-l-doc",
				type: "MASTERS",
				fromNodeId: laura.id,
				toNodeId: documentedKnowledge.id,
				attributes: { level: 4 },
			};

			const report = detectAllRisks(
				[pedro, laura, documentedKnowledge],
				[secondExpert],
			);

			expect(report.risks).toHaveLength(0);
			expect(report.summary.total).toBe(0);
		});
	});
});
