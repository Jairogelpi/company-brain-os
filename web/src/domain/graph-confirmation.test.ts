import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode, KnowledgeNode } from "./graph";
import {
	answerInterviewQuestion,
	createInterviewSession,
	type GraphOperationProposal,
} from "./interview";
import {
	confirmGraphProposals,
	type GraphConfirmationDecision,
} from "./graph-confirmation";

const person: GraphNode = { id: "person-pedro", type: "Person", name: "Pedro" };
const knowledge: KnowledgeNode = {
	id: "knowledge-filler",
	type: "Knowledge",
	name: "configurar llenadora",
	knowledgeType: "technical",
	documented: false,
	validationState: "proposed",
	confidence: 25,
	criticality: "high",
};
const mastery: GraphEdge = {
	id: "edge-masters-pedro-filler",
	type: "MASTERS",
	fromNodeId: person.id,
	toNodeId: knowledge.id,
	attributes: { level: 5 },
};

function approveAll(
	proposals: GraphOperationProposal[],
): GraphConfirmationDecision[] {
	return proposals.map((_, proposalIndex) => ({
		proposalIndex,
		decision: "approve",
	}));
}

describe("graph proposal confirmation boundary", () => {
	it("applies approved create_node and create_edge proposals into a valid graph", () => {
		const proposals: GraphOperationProposal[] = [
			{ type: "create_node", node: person, reason: "key person" },
			{ type: "create_node", node: knowledge, reason: "critical knowledge" },
			{ type: "create_edge", edge: mastery, reason: "expert mastery" },
		];

		const result = confirmGraphProposals({
			proposals,
			decisions: approveAll(proposals),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.graph.nodes).toEqual([person, knowledge]);
		expect(result.graph.edges).toEqual([mastery]);
		expect(result.eventLog.map((event) => event.eventType)).toEqual([
			"graph.proposal.approved",
			"graph.proposal.approved",
			"graph.proposal.approved",
			"graph.proposal.applied",
		]);
	});

	it("logs rejected proposals without applying them", () => {
		const proposals: GraphOperationProposal[] = [
			{ type: "create_node", node: person, reason: "key person" },
			{ type: "create_node", node: knowledge, reason: "critical knowledge" },
		];
		const decisions: GraphConfirmationDecision[] = [
			{ proposalIndex: 0, decision: "approve" },
			{ proposalIndex: 1, decision: "reject", reason: "owner said no" },
		];

		const result = confirmGraphProposals({ proposals, decisions });

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.graph.nodes).toEqual([person]);
		expect(result.eventLog.map((event) => event.eventType)).toEqual([
			"graph.proposal.approved",
			"graph.proposal.rejected",
			"graph.proposal.applied",
		]);
	});

	it("blocks invalid approved edge endpoints and does not partially apply the commit", () => {
		const invalidEdge: GraphEdge = {
			id: "edge-invalid-requires",
			type: "REQUIRES",
			fromNodeId: person.id,
			toNodeId: knowledge.id,
		};
		const proposals: GraphOperationProposal[] = [
			{ type: "create_node", node: person, reason: "key person" },
			{ type: "create_node", node: knowledge, reason: "critical knowledge" },
			{ type: "create_edge", edge: invalidEdge, reason: "bad endpoint" },
		];

		const result = confirmGraphProposals({
			proposals,
			decisions: approveAll(proposals),
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.graph.nodes).toEqual([]);
		expect(result.graph.edges).toEqual([]);
		expect(result.issues.map((issue) => issue.code)).toContain(
			"invalid_edge_endpoint",
		);
		expect(result.eventLog.at(-1)?.eventType).toBe("graph.proposal.failed");
	});

	it("fails update_node decisions that target a missing node", () => {
		const proposals: GraphOperationProposal[] = [
			{
				type: "update_node",
				nodeId: "missing",
				patch: { name: "Missing" },
				reason: "bad update",
			},
		];

		const result = confirmGraphProposals({
			proposals,
			decisions: approveAll(proposals),
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.issues.map((issue) => issue.code)).toEqual([
			"missing_update_node",
		]);
		expect(result.graph.nodes).toEqual([]);
	});

	it("deduplicates duplicate node and edge creates idempotently", () => {
		const proposals: GraphOperationProposal[] = [
			{ type: "create_node", node: person, reason: "first" },
			{ type: "create_node", node: { ...person }, reason: "duplicate" },
			{ type: "create_node", node: knowledge, reason: "knowledge" },
			{ type: "create_edge", edge: mastery, reason: "first edge" },
			{ type: "create_edge", edge: { ...mastery }, reason: "duplicate edge" },
		];

		const result = confirmGraphProposals({
			proposals,
			decisions: approveAll(proposals),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.graph.nodes).toHaveLength(2);
		expect(result.graph.edges).toHaveLength(1);
	});

	it("does not mutate original proposals or the current graph", () => {
		const currentGraph = { nodes: [person], edges: [] };
		const proposals: GraphOperationProposal[] = [
			{
				type: "update_node",
				nodeId: person.id,
				patch: { name: "Pedro updated" },
				reason: "rename",
			},
		];
		const originalGraph = structuredClone(currentGraph);
		const originalProposals = structuredClone(proposals);

		const result = confirmGraphProposals({
			currentGraph,
			proposals,
			decisions: approveAll(proposals),
		});

		expect(result.ok).toBe(true);
		expect(currentGraph).toEqual(originalGraph);
		expect(proposals).toEqual(originalProposals);
	});

	it("confirms interview engine proposals into a valid graph", () => {
		let session = createInterviewSession();
		session = answerInterviewQuestion(
			session,
			"Pedro es indispensable; si falta se para producción.",
		);
		session = answerInterviewQuestion(
			session,
			"Solo Pedro configura la llenadora crítica y nadie más sabe hacerlo.",
		);
		session = answerInterviewQuestion(
			session,
			"Laura lo vio una vez, nivel 2.",
		);
		session = answerInterviewQuestion(
			session,
			"No está escrito en ningún sitio.",
		);

		const result = confirmGraphProposals({
			proposals: session.proposals,
			decisions: approveAll(session.proposals),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.graph.nodes.some((node) => node.type === "Knowledge")).toBe(
			true,
		);
		expect(result.graph.edges.some((edge) => edge.type === "MASTERS")).toBe(
			true,
		);
	});
});
