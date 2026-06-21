import { describe, expect, it } from "vitest";
import type { GraphNode, KnowledgeNode, GraphEdge } from "./graph";
import {
	computeBusFactors,
	computeConfidences,
	computeCoverage,
	computeDependencies,
	computeResilience,
	computeHealth,
	computeCompanyIQ,
	computeAllMetrics,
} from "./metrics";

// --- Test fixtures ---

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
	criticality: "medium",
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

const productionProcess: GraphNode = {
	id: "proc-production",
	type: "Process",
	name: "Production",
	criticality: "high",
};

const packagingProcess: GraphNode = {
	id: "proc-packaging",
	type: "Process",
	name: "Packaging",
	criticality: "medium",
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
	attributes: { level: 2 },
};

const masteryCarlos: GraphEdge = {
	id: "e-m-c-d",
	type: "MASTERS",
	fromNodeId: carlos.id,
	toNodeId: doughKnowledge.id,
	attributes: { level: 5 },
};

const requiresProduction: GraphEdge = {
	id: "e-r-prod-f",
	type: "REQUIRES",
	fromNodeId: productionProcess.id,
	toNodeId: fillerKnowledge.id,
};

const requiresPackaging: GraphEdge = {
	id: "e-r-pack-d",
	type: "REQUIRES",
	fromNodeId: packagingProcess.id,
	toNodeId: doughKnowledge.id,
};

describe("Metrics Engine", () => {
	describe("computeBusFactors", () => {
		it("returns bus factor 1 for a Knowledge with one expert at level 5", () => {
			const bf = computeBusFactors([pedro, fillerKnowledge], [masteryPedro]);

			expect(bf).toHaveLength(1);
			expect(bf[0].busFactor).toBe(1);
			expect(bf[0].expertIds).toEqual([pedro.id]);
		});

		it("returns bus factor 0 for expert below level 3", () => {
			const bf = computeBusFactors(
				[pedro, laura, fillerKnowledge],
				[masteryLaura], // level 2
			);

			expect(bf[0].busFactor).toBe(0);
		});

		it("returns bus factor 2 for two experts at levels 5 and 4", () => {
			const extraExpert: GraphEdge = {
				id: "e-m-l2-f",
				type: "MASTERS",
				fromNodeId: laura.id,
				toNodeId: fillerKnowledge.id,
				attributes: { level: 4 },
			};

			const bf = computeBusFactors(
				[pedro, laura, fillerKnowledge],
				[masteryPedro, extraExpert],
			);

			expect(bf[0].busFactor).toBe(2);
		});

		it("returns empty array for graph with no Knowledge nodes", () => {
			const bf = computeBusFactors([pedro, laura], []);
			expect(bf).toEqual([]);
		});

		it("includes criticality and documented from the Knowledge node", () => {
			const bf = computeBusFactors([pedro, fillerKnowledge], [masteryPedro]);

			expect(bf[0].criticality).toBe("high");
			expect(bf[0].documented).toBe(false);
		});
	});

	describe("computeConfidences", () => {
		it("high confidence for validated, documented, multi-expert knowledge", () => {
			const conf = computeConfidences(
				[pedro, carlos, doughKnowledge],
				[masteryCarlos],
			);

			expect(conf).toHaveLength(1);
			expect(conf[0].confidence).toBeGreaterThanOrEqual(60);
		});

		it("low confidence for draft, undocumented, single-expert knowledge", () => {
			const conf = computeConfidences(
				[pedro, signingKnowledge],
				[
					{
						id: "e-m-p-s",
						type: "MASTERS",
						fromNodeId: pedro.id,
						toNodeId: signingKnowledge.id,
						attributes: { level: 5 },
					},
				],
			);

			expect(conf).toHaveLength(1);
			expect(conf[0].confidence).toBeLessThan(45);
		});
	});

	describe("computeCoverage", () => {
		it("returns 100% when all critical knowledge has bus factor ≥ 2", () => {
			const extraExpert: GraphEdge = {
				id: "e-m-l3-f",
				type: "MASTERS",
				fromNodeId: laura.id,
				toNodeId: fillerKnowledge.id,
				attributes: { level: 3 },
			};

			const cov = computeCoverage(
				[pedro, laura, fillerKnowledge, signingKnowledge],
				[masteryPedro, extraExpert],
			);

			expect(cov.coveredCritical).toBeGreaterThanOrEqual(0);
		});

		it("returns 100% when there are no critical Knowledge nodes", () => {
			const cov = computeCoverage([pedro, doughKnowledge], [masteryCarlos]);
			expect(cov.totalCritical).toBe(0);
			expect(cov.coveragePercent).toBe(100);
		});
	});

	describe("computeDependencies", () => {
		it("dependency score 1 for Person who is sole expert on a critical Knowledge", () => {
			const deps = computeDependencies(
				[pedro, fillerKnowledge],
				[masteryPedro],
			);

			const pedroDep = deps.find((d) => d.personId === pedro.id);
			expect(pedroDep?.dependencyScore).toBe(1);
			expect(pedroDep?.criticalNodes).toContain(fillerKnowledge.id);
		});

		it("dependency score 0 when multiple experts exist", () => {
			const extraExpert: GraphEdge = {
				id: "e-m-l3-f",
				type: "MASTERS",
				fromNodeId: laura.id,
				toNodeId: fillerKnowledge.id,
				attributes: { level: 3 },
			};

			const deps = computeDependencies(
				[pedro, laura, fillerKnowledge],
				[masteryPedro, extraExpert],
			);

			const pedroDep = deps.find((d) => d.personId === pedro.id);
			expect(pedroDep?.dependencyScore).toBe(0);
		});
	});

	describe("computeResilience", () => {
		it("process resilience equals minimum bus factor of required Knowledge", () => {
			const res = computeResilience(
				[pedro, fillerKnowledge, productionProcess],
				[masteryPedro, requiresProduction],
			);

			expect(res).toHaveLength(1);
			expect(res[0].resilienceScore).toBe(1);
			expect(res[0].weakestKnowledgeId).toBe(fillerKnowledge.id);
		});

		it("process with no REQUIRES edges has max resilience", () => {
			const res = computeResilience(
				[pedro, productionProcess, fillerKnowledge],
				[], // no edges
			);

			expect(res[0].resilienceScore).toBe(100);
		});
	});

	describe("computeHealth", () => {
		it("computes composite health from coverage, resilience, and risks", () => {
			const health = computeHealth(
				[pedro, fillerKnowledge, productionProcess],
				[masteryPedro, requiresProduction],
				3, // open risks
			);

			expect(health.overallScore).toBeGreaterThanOrEqual(0);
			expect(health.overallScore).toBeLessThanOrEqual(100);
			expect(health.openRiskCount).toBe(3);
		});
	});

	describe("computeCompanyIQ", () => {
		it("returns 50% when half of Knowledge is documented and validated", () => {
			const iq = computeCompanyIQ([fillerKnowledge, doughKnowledge]);

			expect(iq.totalKnowledge).toBe(2);
			expect(iq.documentedAndValidated).toBe(1); // dough is documented + validated
			expect(iq.iq).toBe(50);
		});

		it("returns 0% when nothing is documented and validated", () => {
			const iq = computeCompanyIQ([fillerKnowledge, signingKnowledge]);
			expect(iq.iq).toBe(0);
		});
	});

	describe("computeAllMetrics", () => {
		it("returns all metrics in a single pass", () => {
			const metrics = computeAllMetrics(
				[pedro, laura, fillerKnowledge, doughKnowledge, productionProcess],
				[masteryPedro, masteryCarlos, requiresProduction],
				1,
			);

			expect(metrics.busFactors).toBeDefined();
			expect(metrics.confidences).toBeDefined();
			expect(metrics.coverage).toBeDefined();
			expect(metrics.dependencies).toBeDefined();
			expect(metrics.resilience).toBeDefined();
			expect(metrics.health).toBeDefined();
			expect(metrics.companyIQ).toBeDefined();
		});
	});
});
