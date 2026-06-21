import type { GraphEdge, GraphNode, ValidationIssue } from "./graph";
import { validateGraph } from "./graph";
import type { GraphOperationProposal } from "./interview";

export type GraphState = {
	nodes: GraphNode[];
	edges: GraphEdge[];
};

export type GraphConfirmationDecision = {
	proposalIndex: number;
	decision: "approve" | "reject";
	reason?: string;
	actorId?: string;
};

export type GraphConfirmationEvent = {
	id: string;
	companyId?: string;
	actorId?: string;
	eventType:
		| "graph.proposal.approved"
		| "graph.proposal.rejected"
		| "graph.proposal.applied"
		| "graph.proposal.failed";
	payload: Record<string, unknown>;
	createdAt: string;
};

type ConfirmationIssue =
	| ValidationIssue
	| {
			code:
				| "missing_decision"
				| "duplicate_decision"
				| "unknown_proposal"
				| "missing_update_node";
			message: string;
	  };

export type GraphConfirmationResult =
	| {
			ok: true;
			graph: GraphState;
			eventLog: GraphConfirmationEvent[];
			issues: [];
	  }
	| {
			ok: false;
			graph: GraphState;
			eventLog: GraphConfirmationEvent[];
			issues: ConfirmationIssue[];
	  };

export function confirmGraphProposals(input: {
	currentGraph?: GraphState;
	proposals: GraphOperationProposal[];
	decisions: GraphConfirmationDecision[];
	companyId?: string;
}): GraphConfirmationResult {
	const originalGraph = cloneGraph(
		input.currentGraph ?? { nodes: [], edges: [] },
	);
	const eventFactory = createEventFactory(input.companyId);
	const decisionIssues = validateDecisions(input.proposals, input.decisions);
	if (decisionIssues.length > 0) {
		return fail(
			originalGraph,
			[eventFactory("graph.proposal.failed", { issues: decisionIssues })],
			decisionIssues,
		);
	}

	const eventLog: GraphConfirmationEvent[] = [];
	const draft = cloneGraph(originalGraph);
	const nodes = new Map(draft.nodes.map((node) => [node.id, node]));
	const edges = new Map(draft.edges.map((edge) => [edge.id, edge]));
	const decisionsByIndex = new Map(
		input.decisions.map((decision) => [decision.proposalIndex, decision]),
	);

	for (const [proposalIndex, proposal] of input.proposals.entries()) {
		const decision = decisionsByIndex.get(proposalIndex)!;
		eventLog.push(
			eventFactory(
				decision.decision === "approve"
					? "graph.proposal.approved"
					: "graph.proposal.rejected",
				{
					proposalIndex,
					proposalType: proposal.type,
					reason: decision.reason,
				},
				decision.actorId,
			),
		);
		if (decision.decision === "reject") continue;

		if (proposal.type === "create_node")
			nodes.set(proposal.node.id, clone(proposal.node));
		if (proposal.type === "create_edge")
			edges.set(proposal.edge.id, clone(proposal.edge));
		if (proposal.type === "update_node") {
			const current = nodes.get(proposal.nodeId);
			if (!current) {
				const issues: ConfirmationIssue[] = [
					{
						code: "missing_update_node",
						message: `Cannot update missing node: ${proposal.nodeId}`,
					},
				];
				eventLog.push(
					eventFactory("graph.proposal.failed", { proposalIndex, issues }),
				);
				return fail(originalGraph, eventLog, issues);
			}
			nodes.set(proposal.nodeId, { ...current, ...clone(proposal.patch) });
		}
	}

	const nextGraph = { nodes: [...nodes.values()], edges: [...edges.values()] };
	const validation = validateGraph(nextGraph.nodes, nextGraph.edges);
	if (!validation.ok) {
		eventLog.push(
			eventFactory("graph.proposal.failed", { issues: validation.issues }),
		);
		return fail(originalGraph, eventLog, validation.issues);
	}

	eventLog.push(
		eventFactory("graph.proposal.applied", {
			approvedCount: input.decisions.filter(
				(decision) => decision.decision === "approve",
			).length,
			rejectedCount: input.decisions.filter(
				(decision) => decision.decision === "reject",
			).length,
			nodeCount: nextGraph.nodes.length,
			edgeCount: nextGraph.edges.length,
		}),
	);
	return { ok: true, graph: nextGraph, eventLog, issues: [] };
}

function validateDecisions(
	proposals: GraphOperationProposal[],
	decisions: GraphConfirmationDecision[],
): ConfirmationIssue[] {
	const issues: ConfirmationIssue[] = [];
	const seen = new Set<number>();
	for (const decision of decisions) {
		if (
			decision.proposalIndex < 0 ||
			decision.proposalIndex >= proposals.length
		) {
			issues.push({
				code: "unknown_proposal",
				message: `Unknown proposal index: ${decision.proposalIndex}`,
			});
		}
		if (seen.has(decision.proposalIndex)) {
			issues.push({
				code: "duplicate_decision",
				message: `Duplicate decision for proposal: ${decision.proposalIndex}`,
			});
		}
		seen.add(decision.proposalIndex);
	}
	for (const proposalIndex of proposals.keys()) {
		if (!seen.has(proposalIndex)) {
			issues.push({
				code: "missing_decision",
				message: `Missing decision for proposal: ${proposalIndex}`,
			});
		}
	}
	return issues;
}

function createEventFactory(companyId?: string) {
	let nextId = 1;
	return (
		eventType: GraphConfirmationEvent["eventType"],
		payload: Record<string, unknown>,
		actorId?: string,
	): GraphConfirmationEvent => ({
		id: `event-${nextId++}`,
		companyId,
		actorId,
		eventType,
		payload,
		createdAt: new Date(0).toISOString(),
	});
}

function fail(
	graph: GraphState,
	eventLog: GraphConfirmationEvent[],
	issues: ConfirmationIssue[],
): GraphConfirmationResult {
	return { ok: false, graph: cloneGraph(graph), eventLog, issues };
}

function cloneGraph(graph: GraphState): GraphState {
	return { nodes: clone(graph.nodes), edges: clone(graph.edges) };
}

function clone<T>(value: T): T {
	return structuredClone(value);
}
