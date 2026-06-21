import type {
	GraphEdge,
	GraphNode,
	KnowledgeNode,
	ValidationIssue,
} from "./graph";
import { validateGraph } from "./graph";
import type { GraphOperationProposal } from "./interview";
import type { GraphConfirmationDecision } from "./graph-confirmation";
import { confirmGraphProposals } from "./graph-confirmation";

// --- Event log types (shaped for drizzle event_log table) ---

export type GraphServiceEvent = {
	id: string;
	companyId?: string;
	actorId?: string;
	eventType:
		| "graph.node.created"
		| "graph.node.updated"
		| "graph.node.deleted"
		| "graph.edge.created"
		| "graph.edge.updated"
		| "graph.edge.deleted";
	payload: Record<string, unknown>;
	createdAt: string;
};

export type GraphServiceOptions = {
	actorId?: string;
	companyId?: string;
};

// --- Graph Service (deterministic, in-memory, mutable source of truth) ---

export interface GraphService {
	// Node CRUD
	createNode(node: GraphNode | KnowledgeNode): GraphServiceEvent;
	readNode(id: string): GraphNode | undefined;
	updateNode(
		id: string,
		patch: Partial<GraphNode | KnowledgeNode>,
	): GraphServiceEvent;
	deleteNode(id: string): GraphServiceEvent;
	listNodes(): GraphNode[];

	// Edge CRUD
	createEdge(edge: GraphEdge): GraphServiceEvent;
	readEdge(id: string): GraphEdge | undefined;
	updateEdge(id: string, patch: Partial<GraphEdge>): GraphServiceEvent;
	deleteEdge(id: string): GraphServiceEvent;
	listEdges(): GraphEdge[];

	// Proposal integration
	applyConfirmedProposals(
		proposals: GraphOperationProposal[],
	): GraphServiceEvent[];
	applyProposalsWithDecisions(
		proposals: GraphOperationProposal[],
		decisions: GraphConfirmationDecision[],
	): GraphServiceEvent[];

	// Event log
	eventLog(): GraphServiceEvent[];
}

export function createGraphService(
	options?: GraphServiceOptions,
): GraphService {
	const nodes = new Map<string, GraphNode>();
	const edges = new Map<string, GraphEdge>();
	const events: GraphServiceEvent[] = [];
	let nextEventId = 1;
	const actorId = options?.actorId;
	const companyId = options?.companyId;

	function emit(
		eventType: GraphServiceEvent["eventType"],
		payload: Record<string, unknown>,
	): GraphServiceEvent {
		const event: GraphServiceEvent = {
			id: `evt-${nextEventId++}`,
			companyId,
			actorId,
			eventType,
			payload: structuredClone(payload),
			createdAt: new Date().toISOString(),
		};
		events.push(event);
		return event;
	}

	function cloneNode(node: GraphNode): GraphNode {
		return structuredClone(node);
	}

	function cloneEdge(edge: GraphEdge): GraphEdge {
		return structuredClone(edge);
	}

	function validateSnapshot(): void {
		const nodeList = [...nodes.values()];
		const edgeList = [...edges.values()];
		const result = validateGraph(nodeList, edgeList);
		if (!result.ok) {
			const messages = result.issues
				.map((issue: ValidationIssue) => issue.message)
				.join("; ");
			throw new Error(`Invalid graph state: ${messages}`);
		}
	}

	// --- Node CRUD ---

	function createNode(node: GraphNode | KnowledgeNode): GraphServiceEvent {
		if (nodes.has(node.id)) {
			throw new Error(`Node already exists: ${node.id}`);
		}
		// Apply optimistically, validate, revert on failure
		nodes.set(node.id, cloneNode(node));
		try {
			validateSnapshot();
		} catch (error: unknown) {
			nodes.delete(node.id);
			throw error;
		}
		return emit("graph.node.created", {
			nodeId: node.id,
			after: cloneNode(node),
		});
	}

	function readNode(id: string): GraphNode | undefined {
		const node = nodes.get(id);
		return node ? cloneNode(node) : undefined;
	}

	function updateNode(
		id: string,
		patch: Partial<GraphNode | KnowledgeNode>,
	): GraphServiceEvent {
		const current = nodes.get(id);
		if (!current) {
			throw new Error(`Missing node: ${id}`);
		}
		const before = cloneNode(current);
		const updated = { ...current, ...structuredClone(patch) };
		nodes.set(id, updated);
		try {
			validateSnapshot();
		} catch (error: unknown) {
			nodes.set(id, before);
			throw error;
		}
		return emit("graph.node.updated", {
			nodeId: id,
			before,
			after: cloneNode(updated),
		});
	}

	function deleteNode(id: string): GraphServiceEvent {
		const current = nodes.get(id);
		if (!current) {
			throw new Error(`Missing node: ${id}`);
		}
		const before = cloneNode(current);
		// Find all edges referencing this node
		const cascadedEdgeIds: string[] = [];
		for (const edge of edges.values()) {
			if (edge.fromNodeId === id || edge.toNodeId === id) {
				cascadedEdgeIds.push(edge.id);
			}
		}
		// Remove cascaded edges
		for (const edgeId of cascadedEdgeIds) {
			edges.delete(edgeId);
		}
		nodes.delete(id);
		return emit("graph.node.deleted", {
			nodeId: id,
			before,
			cascadedEdgeIds,
		});
	}

	function listNodes(): GraphNode[] {
		return [...nodes.values()].map(cloneNode);
	}

	// --- Edge CRUD ---

	function createEdge(edge: GraphEdge): GraphServiceEvent {
		if (edges.has(edge.id)) {
			throw new Error(`Edge already exists: ${edge.id}`);
		}
		if (!nodes.has(edge.fromNodeId) || !nodes.has(edge.toNodeId)) {
			throw new Error(
				`Edge references missing node(s): from=${edge.fromNodeId} to=${edge.toNodeId}`,
			);
		}
		edges.set(edge.id, cloneEdge(edge));
		try {
			validateSnapshot();
		} catch (error: unknown) {
			edges.delete(edge.id);
			throw error;
		}
		return emit("graph.edge.created", {
			edgeId: edge.id,
			after: cloneEdge(edge),
		});
	}

	function readEdge(id: string): GraphEdge | undefined {
		const edge = edges.get(id);
		return edge ? cloneEdge(edge) : undefined;
	}

	function updateEdge(
		id: string,
		patch: Partial<GraphEdge>,
	): GraphServiceEvent {
		const current = edges.get(id);
		if (!current) {
			throw new Error(`Missing edge: ${id}`);
		}
		const before = cloneEdge(current);
		const updated = { ...current, ...structuredClone(patch) };
		edges.set(id, updated);
		try {
			validateSnapshot();
		} catch (error: unknown) {
			edges.set(id, before);
			throw error;
		}
		return emit("graph.edge.updated", {
			edgeId: id,
			before,
			after: cloneEdge(updated),
		});
	}

	function deleteEdge(id: string): GraphServiceEvent {
		const current = edges.get(id);
		if (!current) {
			throw new Error(`Missing edge: ${id}`);
		}
		const before = cloneEdge(current);
		edges.delete(id);
		return emit("graph.edge.deleted", {
			edgeId: id,
			before,
		});
	}

	function listEdges(): GraphEdge[] {
		return [...edges.values()].map(cloneEdge);
	}

	// --- Proposal integration ---

	function restoreSnapshot(
		nodeSnapshot: Map<string, GraphNode>,
		edgeSnapshot: Map<string, GraphEdge>,
		eventLength: number,
		eventIdSnapshot: number,
	): void {
		nodes.clear();
		edges.clear();
		for (const [id, node] of nodeSnapshot) nodes.set(id, cloneNode(node));
		for (const [id, edge] of edgeSnapshot) edges.set(id, cloneEdge(edge));
		events.length = eventLength;
		nextEventId = eventIdSnapshot;
	}

	function applyConfirmedProposals(
		proposals: GraphOperationProposal[],
	): GraphServiceEvent[] {
		const nodeSnapshot = new Map(
			[...nodes.entries()].map(([id, node]) => [id, cloneNode(node)]),
		);
		const edgeSnapshot = new Map(
			[...edges.entries()].map(([id, edge]) => [id, cloneEdge(edge)]),
		);
		const eventLength = events.length;
		const eventIdSnapshot = nextEventId;
		const collectedEvents: GraphServiceEvent[] = [];
		try {
			for (const proposal of proposals) {
				let event: GraphServiceEvent;
				if (proposal.type === "create_node") {
					if (nodes.has(proposal.node.id)) {
						// Idempotent: boundary deduplicates creates; a confirmed
						// duplicate create on an already-present node is a no-op.
						continue;
					}
					event = createNode(proposal.node);
				} else if (proposal.type === "create_edge") {
					if (edges.has(proposal.edge.id)) {
						// Idempotent: duplicate confirmed create on an existing edge.
						continue;
					}
					event = createEdge(proposal.edge);
				} else if (proposal.type === "update_node") {
					event = updateNode(proposal.nodeId, proposal.patch);
				} else {
					throw new Error(
						`Unknown proposal type: ${(proposal as GraphOperationProposal).type}`,
					);
				}
				collectedEvents.push(event);
			}
			return collectedEvents;
		} catch (error) {
			restoreSnapshot(nodeSnapshot, edgeSnapshot, eventLength, eventIdSnapshot);
			throw error;
		}
	}

	function applyProposalsWithDecisions(
		proposals: GraphOperationProposal[],
		decisions: GraphConfirmationDecision[],
	): GraphServiceEvent[] {
		// Use the confirmation boundary to separate approved/rejected,
		// then apply only approved proposals through the service.
		const currentGraph = {
			nodes: listNodes(),
			edges: listEdges(),
		};
		const confirmationResult = confirmGraphProposals({
			currentGraph,
			proposals,
			decisions,
			companyId,
		});

		if (!confirmationResult.ok) {
			const messages = confirmationResult.issues
				.map(
					(issue: ValidationIssue | { code: string; message: string }) =>
						issue.message,
				)
				.join("; ");
			throw new Error(`Invalid proposals: ${messages}`);
		}

		// Apply the confirmed (approved) graph state
		// Reset and rebuild to match the confirmed state
		const approvedGraph = confirmationResult.graph;

		// Collect approved proposal indices for event emission
		const approvedProposals = proposals.filter(
			(_: GraphOperationProposal, i: number) =>
				decisions[i]?.decision === "approve",
		);

		// Apply each approved proposal through the service CRUD
		// First, remove any nodes/edges that exist but aren't in the approved graph
		const approvedNodeIds = new Set(
			approvedGraph.nodes.map((n: GraphNode) => n.id),
		);
		const approvedEdgeIds = new Set(
			approvedGraph.edges.map((e: GraphEdge) => e.id),
		);

		// Delete edges not in approved graph
		for (const edgeId of [...edges.keys()]) {
			if (!approvedEdgeIds.has(edgeId)) {
				deleteEdge(edgeId);
			}
		}

		// Delete nodes not in approved graph
		for (const nodeId of [...nodes.keys()]) {
			if (!approvedNodeIds.has(nodeId)) {
				deleteNode(nodeId);
			}
		}

		// Create/update nodes and edges from approved proposals only
		return applyConfirmedProposals(approvedProposals);
	}

	function eventLog(): GraphServiceEvent[] {
		return events.map((event) => structuredClone(event));
	}

	return {
		createNode,
		readNode,
		updateNode,
		deleteNode,
		listNodes,
		createEdge,
		readEdge,
		updateEdge,
		deleteEdge,
		listEdges,
		applyConfirmedProposals,
		applyProposalsWithDecisions,
		eventLog,
	};
}
