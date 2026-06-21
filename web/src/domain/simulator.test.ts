import { describe, expect, it } from "vitest";
import type { GraphNode, KnowledgeNode, GraphEdge } from "./graph";
import { simulatePersonLeaving, simulateMultipleLeaving } from "./simulator";

// --- Fixtures ---

const pedro: GraphNode = { id: "pedro", type: "Person", name: "Pedro" };
const laura: GraphNode = { id: "laura", type: "Person", name: "Laura" };
const carlos: GraphNode = { id: "carlos", type: "Person", name: "Carlos" };

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

const masteryLaura: GraphEdge = {
	id: "e-m-l-f",
	type: "MASTERS",
	fromNodeId: laura.id,
	toNodeId: fillerKnowledge.id,
	attributes: { level: 4 },
};

const masteryCarlos: GraphEdge = {
	id: "e-m-c-d",
	type: "MASTERS",
	fromNodeId: carlos.id,
	toNodeId: doughKnowledge.id,
	attributes: { level: 5 },
};

const requiresProduction: GraphEdge = {
	id: "e-r-p-f",
	type: "REQUIRES",
	fromNodeId: productionProcess.id,
	toNodeId: fillerKnowledge.id,
};

describe("Company Simulator", () => {
	describe("simulatePersonLeaving", () => {
		it("reports lost knowledge when sole expert leaves", () => {
			const report = simulatePersonLeaving(
				[pedro, fillerKnowledge],
				[masteryPedro],
				pedro.id,
			);

			expect(report.personName).toBe("Pedro");
			expect(report.knowledgeImpacts).toHaveLength(1);
			expect(report.knowledgeImpacts[0].impact).toBe("lost");
			expect(report.knowledgeImpacts[0].busFactorBefore).toBe(1);
			expect(report.knowledgeImpacts[0].busFactorAfter).toBe(0);
			expect(report.summary.lostKnowledge).toBe(1);
			expect(report.summary.healthDrop).toBeGreaterThanOrEqual(0);
		});

		it("reports degraded knowledge when one of several experts leaves", () => {
			const report = simulatePersonLeaving(
				[pedro, laura, fillerKnowledge],
				[masteryPedro, masteryLaura],
				pedro.id,
			);

			const impact = report.knowledgeImpacts.find(
				(k) => k.knowledgeId === fillerKnowledge.id,
			);
			expect(impact?.impact).toBe("degraded");
			expect(impact?.busFactorBefore).toBe(2);
			expect(impact?.busFactorAfter).toBe(1);
		});

		it("reports no impact when leaving person has no edges", () => {
			const report = simulatePersonLeaving(
				[pedro, laura, carlos, fillerKnowledge, doughKnowledge],
				[masteryPedro, masteryCarlos],
				laura.id,
			);

			// Laura's departure shouldn't affect anything
			const fillerImpact = report.knowledgeImpacts.find(
				(k) => k.knowledgeId === fillerKnowledge.id,
			);
			expect(fillerImpact?.impact).toBe("unchanged");
		});

		it("detects broken processes when process resilience drops to zero", () => {
			const report = simulatePersonLeaving(
				[pedro, fillerKnowledge, productionProcess],
				[masteryPedro, requiresProduction],
				pedro.id,
			);

			const procImpact = report.processImpacts.find(
				(p) => p.processId === productionProcess.id,
			);
			expect(procImpact?.impact).toBe("broken");
			expect(report.summary.brokenProcesses).toBeGreaterThanOrEqual(1);
		});

		it("computes dependency shifts for remaining people", () => {
			const report = simulatePersonLeaving(
				[pedro, laura, fillerKnowledge],
				[masteryPedro, masteryLaura],
				pedro.id,
			);

			const lauraShift = report.dependencyShifts.find(
				(d) => d.personId === laura.id,
			);
			expect(lauraShift).toBeDefined();
			expect(lauraShift?.dependencyScoreAfter).toBeGreaterThanOrEqual(
				lauraShift?.dependencyScoreBefore ?? 0,
			);
		});

		it("generates a descriptive summary message for high impact", () => {
			const report = simulatePersonLeaving(
				[pedro, fillerKnowledge, productionProcess],
				[masteryPedro, requiresProduction],
				pedro.id,
			);

			expect(report.summary.message).toContain("If Pedro leaves");
			expect(report.summary.message).toContain("LOST");
		});

		it("generates a reassuring summary when impact is low", () => {
			const report = simulatePersonLeaving(
				[pedro, laura, fillerKnowledge],
				[masteryPedro, masteryLaura],
				pedro.id,
			);

			expect(report.summary.lostKnowledge).toBe(0);
			expect(report.summary.degradedKnowledge).toBe(1);
		});

		it("calculates before/after metrics and risks", () => {
			const report = simulatePersonLeaving(
				[pedro, fillerKnowledge, doughKnowledge, carlos],
				[masteryPedro, masteryCarlos],
				pedro.id,
			);

			expect(report.metricsBefore.busFactors.length).toBeGreaterThanOrEqual(
				report.metricsAfter.busFactors.length,
			);
			expect(report.risksBefore).toBeDefined();
			expect(report.risksAfter).toBeDefined();
			expect(report.summary.newRisks).toBeGreaterThanOrEqual(0);
		});

		it("signals an explicit person-not-found result for unknown ids", () => {
			const report = simulatePersonLeaving(
				[pedro, fillerKnowledge],
				[masteryPedro],
				"ghost",
			);

			expect(report.summary.message).toContain("Person not found");
			expect(report.summary.lostKnowledge).toBe(0);
			expect(report.summary.brokenProcesses).toBe(0);
		});
	});

	describe("simulateMultipleLeaving", () => {
		it("simulates multiple people leaving simultaneously", () => {
			const report = simulateMultipleLeaving(
				[pedro, laura, carlos, fillerKnowledge, doughKnowledge],
				[masteryPedro, masteryLaura, masteryCarlos],
				[pedro.id, carlos.id],
			);

			expect(report.personName).toContain("Pedro");
			expect(report.personName).toContain("Carlos");
			expect(report.scenario).toContain("all leave");

			// Carlos's dough knowledge should be lost (sole expert); Pedro's filler knowledge degrades (Laura remains)
			const lostCount = report.knowledgeImpacts.filter(
				(k) => k.impact === "lost",
			).length;
			expect(lostCount).toBeGreaterThanOrEqual(1);
		});
	});
});
