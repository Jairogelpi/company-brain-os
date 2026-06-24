import { describe, expect, it } from "vitest";
import {
	EDGE_TYPES,
	NODE_TYPES,
	type GraphEdge,
	type GraphNode,
	type KnowledgeNode,
	validateGraph,
} from "./graph";

const nodes: (GraphNode | KnowledgeNode)[] = [
	{ id: "person-1", type: "Person", name: "Pedro" },
	{
		id: "knowledge-1",
		type: "Knowledge",
		name: "Configure filler machine",
		knowledgeType: "technical",
		documented: false,
		validationState: "draft",
		confidence: 42,
		criticality: "high",
	},
	{ id: "process-1", type: "Process", name: "Production" },
	{ id: "asset-1", type: "Asset", name: "Filler machine" },
	{ id: "unit-1", type: "Unit", name: "Operations" },
	{ id: "risk-1", type: "Risk", name: "Single expert" },
];

describe("universal graph F0 invariants", () => {
	it("keeps the universal catalog closed at 11 node types and 12 edge types", () => {
		expect(NODE_TYPES).toEqual([
			"Person",
			"Knowledge",
			"Process",
			"Asset",
			"Unit",
			"Risk",
			"Client",
			"Supplier",
			"Project",
			"System",
			"Document",
		]);
		expect(EDGE_TYPES).toEqual([
			"MASTERS",
			"LEARNS",
			"REQUIRES",
			"EXECUTES",
			"PRODUCES",
			"DEPENDS_ON",
			"BELONGS_TO",
			"BACKS_UP",
			"OWNS",
			"MANAGES",
			"ADMINISTERS",
			"DOCUMENTS",
		]);
	});

	it("accepts every allowed edge endpoint rule from the spec", () => {
		const edges: GraphEdge[] = [
			{
				id: "e1",
				type: "MASTERS",
				fromNodeId: "person-1",
				toNodeId: "knowledge-1",
			},
			{
				id: "e2",
				type: "LEARNS",
				fromNodeId: "person-1",
				toNodeId: "knowledge-1",
			},
			{
				id: "e3",
				type: "REQUIRES",
				fromNodeId: "process-1",
				toNodeId: "knowledge-1",
			},
			{
				id: "e4",
				type: "REQUIRES",
				fromNodeId: "process-1",
				toNodeId: "asset-1",
			},
			{
				id: "e5",
				type: "EXECUTES",
				fromNodeId: "person-1",
				toNodeId: "process-1",
			},
			{
				id: "e6",
				type: "PRODUCES",
				fromNodeId: "process-1",
				toNodeId: "asset-1",
			},
			{
				id: "e7",
				type: "DEPENDS_ON",
				fromNodeId: "risk-1",
				toNodeId: "asset-1",
			},
			{
				id: "e8",
				type: "BELONGS_TO",
				fromNodeId: "person-1",
				toNodeId: "unit-1",
			},
			{
				id: "e9",
				type: "BELONGS_TO",
				fromNodeId: "process-1",
				toNodeId: "unit-1",
			},
			{
				id: "e10",
				type: "BELONGS_TO",
				fromNodeId: "asset-1",
				toNodeId: "unit-1",
			},
		];

		expect(validateGraph(nodes, edges)).toEqual({ ok: true, issues: [] });
	});

	it("rejects invalid endpoints, unknown edge types, and unknown node types", () => {
		const invalidNodes = [
			...nodes,
			{
				id: "sector-1",
				type: "Department",
				name: "Custom type",
			} as unknown as GraphNode,
		];
		const invalidEdges = [
			{
				id: "bad-1",
				type: "REQUIRES",
				fromNodeId: "person-1",
				toNodeId: "knowledge-1",
			},
			{
				id: "bad-2",
				type: "KNOWS",
				fromNodeId: "person-1",
				toNodeId: "knowledge-1",
			},
		] as unknown as GraphEdge[];

		const result = validateGraph(invalidNodes, invalidEdges);

		expect(result.ok).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toEqual([
			"unknown_node_type",
			"invalid_edge_endpoint",
			"unknown_edge_type",
		]);
	});

	it("rejects edges that reference missing nodes", () => {
		const result = validateGraph(nodes, [
			{
				id: "missing",
				type: "MASTERS",
				fromNodeId: "person-1",
				toNodeId: "missing-knowledge",
			},
		]);

		expect(result.ok).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toEqual([
			"unknown_edge_node",
		]);
	});

	it("requires Knowledge nodes to carry knowledge_type and confidence 0-100", () => {
		const invalidKnowledge = {
			id: "knowledge-2",
			type: "Knowledge",
			name: "Unwritten rule",
			knowledgeType: "custom-sector-type",
			confidence: 101,
		} as unknown as KnowledgeNode;

		const result = validateGraph([invalidKnowledge], []);

		expect(result.ok).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toEqual([
			"invalid_knowledge_type",
			"invalid_confidence",
		]);
	});
});
