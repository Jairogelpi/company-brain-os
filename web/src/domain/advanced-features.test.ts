import { describe, expect, it } from "vitest";
import type { GraphNode, KnowledgeNode, GraphEdge } from "./graph";
import {
	computeTransferVelocity,
	buildNodeTimeline,
	simulateDeepImpact,
	generateMermaidDiagram,
} from "./advanced-features";

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
const productionProcess: GraphNode = {
	id: "proc-prod",
	type: "Process",
	name: "Production",
	criticality: "high",
};
const machineAsset: GraphNode = {
	id: "asset-machine",
	type: "Asset",
	name: "Llenadora",
	criticality: "high",
};

const requiresProduction: GraphEdge = {
	id: "e-r-p-f",
	type: "REQUIRES",
	fromNodeId: productionProcess.id,
	toNodeId: fillerKnowledge.id,
};
const requiresMachine: GraphEdge = {
	id: "e-r-p-m",
	type: "REQUIRES",
	fromNodeId: productionProcess.id,
	toNodeId: machineAsset.id,
};
const dependsProcess: GraphEdge = {
	id: "e-d-m-p",
	type: "DEPENDS_ON",
	fromNodeId: machineAsset.id,
	toNodeId: productionProcess.id,
};

describe("Transfer Velocity", () => {
	it("computes positive velocity when level increases", () => {
		const v = computeTransferVelocity(
			{ level: 2, timestamp: "2026-01-01" },
			{ level: 4, timestamp: "2026-02-01" },
		);
		expect(v).toBeGreaterThan(1);
	});

	it("returns 0 when level stays the same", () => {
		const v = computeTransferVelocity(
			{ level: 3, timestamp: "2026-01-01" },
			{ level: 3, timestamp: "2026-06-01" },
		);
		expect(v).toBe(0);
	});

	it("returns 0 for same timestamp", () => {
		const v = computeTransferVelocity(
			{ level: 2, timestamp: "2026-01-01" },
			{ level: 4, timestamp: "2026-01-01" },
		);
		expect(v).toBe(0);
	});
});

describe("Node Timeline", () => {
	it("builds a timeline from event log", () => {
		const timeline = buildNodeTimeline("n1", "Test Node", [
			{
				eventType: "graph.node.created",
				createdAt: "2026-01-01",
				payload: { nodeId: "n1", actorId: "pedro" },
			},
			{
				eventType: "graph.node.updated",
				createdAt: "2026-02-01",
				payload: { nodeId: "n1", actorId: "laura" },
			},
		]);

		expect(timeline.events).toHaveLength(2);
		expect(timeline.events[0].type).toBe("graph.node.created");
		expect(timeline.events[1].description).toContain("Updated");
	});

	it("filters events not related to the node", () => {
		const timeline = buildNodeTimeline("n1", "Test", [
			{
				eventType: "graph.node.created",
				createdAt: "2026-01-01",
				payload: { nodeId: "n2" },
			},
			{
				eventType: "graph.node.created",
				createdAt: "2026-01-02",
				payload: { nodeId: "n1" },
			},
		]);

		expect(timeline.events).toHaveLength(1);
	});
});

describe("Deep Simulator", () => {
	it("traverses REQUIRES chain when process is removed", () => {
		const report = simulateDeepImpact(
			[pedro, fillerKnowledge, productionProcess, machineAsset],
			[requiresProduction, requiresMachine, dependsProcess],
			productionProcess.id,
		);

		expect(report.directImpacts.length).toBeGreaterThanOrEqual(2);
		expect(report.summary.totalBlocked).toBeGreaterThanOrEqual(1);
		expect(report.summary.message).toContain("blocks");
	});

	it("reports no impact for isolated removal", () => {
		const report = simulateDeepImpact([pedro, laura], [], pedro.id);

		expect(report.summary.totalBlocked).toBe(0);
		expect(report.summary.message).toContain("no structural impact");
	});
});

describe("Auto-diagrams", () => {
	it("generates a mermaid diagram", () => {
		const diagram = generateMermaidDiagram(
			[pedro, fillerKnowledge],
			[
				{
					id: "e-m",
					type: "MASTERS",
					fromNodeId: pedro.id,
					toNodeId: fillerKnowledge.id,
					attributes: { level: 5 },
				},
			],
		);

		expect(diagram).toContain("graph TD");
		expect(diagram).toContain("MASTERS L5");
		expect(diagram).toContain("Pedro");
	});

	it("generates centered diagram for a specific node", () => {
		const diagram = generateMermaidDiagram(
			[pedro, laura, fillerKnowledge],
			[
				{
					id: "e1",
					type: "MASTERS",
					fromNodeId: pedro.id,
					toNodeId: fillerKnowledge.id,
					attributes: {},
				},
				{
					id: "e2",
					type: "LEARNS",
					fromNodeId: laura.id,
					toNodeId: fillerKnowledge.id,
					attributes: {},
				},
			],
			fillerKnowledge.id,
		);

		expect(diagram).toContain("MASTERS");
		expect(diagram).toContain("LEARNS");
	});
});
