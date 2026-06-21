import { describe, expect, it } from "vitest";
import type { GraphNode, KnowledgeNode, GraphEdge } from "./graph";
import {
	computeBusFactors,
	computeConfidences,
	computeCoverage,
	computeHealth,
	computeCompanyIQ,
} from "./metrics";
import { classifyMediaType } from "@/lib/upload-policy";

/**
 * Property-based tests: generate random valid graphs and verify
 * that metrics never produce impossible states.
 */
function randomNodeType(): string {
	const types = ["Person", "Knowledge", "Process", "Asset", "Unit", "Risk"];
	return types[Math.floor(Math.random() * types.length)];
}

function randomKnowledge(): KnowledgeNode {
	const types: Array<"technical" | "process" | "rule" | "value" | "policy"> = [
		"technical",
		"process",
		"rule",
		"value",
		"policy",
	];
	const states: Array<"draft" | "proposed" | "validated" | "retired"> = [
		"draft",
		"proposed",
		"validated",
		"retired",
	];
	const crits: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];

	return {
		id: `k-${Math.random().toString(36).slice(2, 8)}`,
		type: "Knowledge",
		name: `knowledge-${Math.floor(Math.random() * 100)}`,
		knowledgeType: types[Math.floor(Math.random() * types.length)],
		documented: Math.random() > 0.5,
		validationState: states[Math.floor(Math.random() * states.length)],
		confidence: Math.floor(Math.random() * 100),
		criticality: crits[Math.floor(Math.random() * crits.length)],
	};
}

function randomPerson(): GraphNode {
	return {
		id: `p-${Math.random().toString(36).slice(2, 8)}`,
		type: "Person",
		name: `Person-${Math.floor(Math.random() * 100)}`,
	};
}

function randomEdge(fromId: string, toId: string): GraphEdge {
	const edgeTypes = [
		"MASTERS",
		"LEARNS",
		"REQUIRES",
		"EXECUTES",
		"PRODUCES",
		"DEPENDS_ON",
		"BELONGS_TO",
	] as const;
	return {
		id: `e-${Math.random().toString(36).slice(2, 8)}`,
		type: edgeTypes[Math.floor(Math.random() * edgeTypes.length)],
		fromNodeId: fromId,
		toNodeId: toId,
		attributes: { level: Math.floor(Math.random() * 6) },
	};
}

function generateValidGraph(size: number): {
	nodes: GraphNode[];
	edges: GraphEdge[];
} {
	const nodes: GraphNode[] = [];
	const edges: GraphEdge[] = [];

	// Add people
	for (let i = 0; i < Math.max(1, Math.floor(size / 3)); i++) {
		nodes.push(randomPerson());
	}

	// Add knowledge nodes
	for (let i = 0; i < Math.max(1, Math.floor(size / 3)); i++) {
		nodes.push(randomKnowledge());
	}

	// Add other node types
	for (let i = nodes.length; i < size; i++) {
		const type = randomNodeType();
		if (type === "Knowledge") {
			nodes.push(randomKnowledge());
		} else {
			nodes.push({
				id: `n-${Math.random().toString(36).slice(2, 8)}`,
				type: type as GraphNode["type"],
				name: `${type}-${i}`,
			});
		}
	}

	// Add edges (MASTERS from people to knowledge, others random)
	const people = nodes.filter((n) => n.type === "Person");
	const knowledge = nodes.filter((n) => n.type === "Knowledge");

	for (const p of people) {
		const target = knowledge[Math.floor(Math.random() * knowledge.length)];
		if (target) edges.push(randomEdge(p.id, target.id));
	}

	return { nodes, edges };
}

describe("Property-based tests", () => {
	it("bus factors are always non-negative", () => {
		for (let i = 0; i < 20; i++) {
			const { nodes, edges } = generateValidGraph(10);
			const bfs = computeBusFactors(nodes, edges);
			for (const bf of bfs) {
				expect(bf.busFactor).toBeGreaterThanOrEqual(0);
			}
		}
	});

	it("confidence is always between 0 and 100 inclusive", () => {
		for (let i = 0; i < 20; i++) {
			const { nodes, edges } = generateValidGraph(10);
			const confs = computeConfidences(nodes, edges);
			for (const c of confs) {
				expect(c.confidence).toBeGreaterThanOrEqual(0);
				expect(c.confidence).toBeLessThanOrEqual(100);
			}
		}
	});

	it("coverage percentage is always between 0 and 100", () => {
		for (let i = 0; i < 20; i++) {
			const { nodes, edges } = generateValidGraph(10);
			const cov = computeCoverage(nodes, edges);
			expect(cov.coveragePercent).toBeGreaterThanOrEqual(0);
			expect(cov.coveragePercent).toBeLessThanOrEqual(100);
		}
	});

	it("health score is always between 0 and 100", () => {
		for (let i = 0; i < 20; i++) {
			const { nodes, edges } = generateValidGraph(10);
			const health = computeHealth(nodes, edges, Math.floor(Math.random() * 5));
			expect(health.overallScore).toBeGreaterThanOrEqual(0);
			expect(health.overallScore).toBeLessThanOrEqual(100);
		}
	});

	it("company IQ is always between 0 and 100", () => {
		for (let i = 0; i < 20; i++) {
			const { nodes } = generateValidGraph(10);
			const iq = computeCompanyIQ(nodes);
			expect(iq.iq).toBeGreaterThanOrEqual(0);
			expect(iq.iq).toBeLessThanOrEqual(100);
		}
	});

	it("documentedAndValidated never exceeds totalKnowledge", () => {
		for (let i = 0; i < 20; i++) {
			const { nodes } = generateValidGraph(10);
			const iq = computeCompanyIQ(nodes);
			expect(iq.documentedAndValidated).toBeLessThanOrEqual(iq.totalKnowledge);
		}
	});
});

describe("Excel parsing", () => {
	// xlsx parsing is done via the xlsx npm package; the upload pipeline
	// classifies xlsx as "document" via classifyMediaType.
	it("xlsx files are classified as document in upload", () => {
		expect(
			classifyMediaType(
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			),
		).toBe("document");
	});
});
