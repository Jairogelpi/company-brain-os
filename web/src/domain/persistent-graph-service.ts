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
import type { GraphRepository } from "@/db/repository";

// --- Event types (drizzle-compatible) ---

export type PersistentGraphEvent = {
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
	createdAt?: string;
};

// --- Async Graph Service (repo-backed) ---

export interface PersistentGraphService {
	createNode(node: GraphNode | KnowledgeNode): Promise<PersistentGraphEvent>;
	readNode(id: string): Promise<GraphNode | undefined>;
	updateNode(
		id: string,
		patch: Partial<GraphNode | KnowledgeNode>,
	): Promise<PersistentGraphEvent>;
	deleteNode(id: string): Promise<PersistentGraphEvent>;
	listNodes(): Promise<GraphNode[]>;

	createEdge(edge: GraphEdge): Promise<PersistentGraphEvent>;
	readEdge(id: string): Promise<GraphEdge | undefined>;
	updateEdge(
		id: string,
		patch: Partial<GraphEdge>,
	): Promise<PersistentGraphEvent>;
	deleteEdge(id: string): Promise<PersistentGraphEvent>;
	listEdges(): Promise<GraphEdge[]>;

	applyProposalsWithDecisions(
		proposals: GraphOperationProposal[],
		decisions: GraphConfirmationDecision[],
	): Promise<PersistentGraphEvent[]>;
	applyConfirmedProposals(
		proposals: GraphOperationProposal[],
	): Promise<PersistentGraphEvent[]>;

	listEvents(): Promise<PersistentGraphEvent[]>;
}

export type PersistentGraphOptions = {
	actorId?: string;
	companyId?: string;
};

export function createPersistentGraphService(
	repo: GraphRepository,
	options?: PersistentGraphOptions,
): PersistentGraphService {
	const actorId = options?.actorId;
	const companyId = options?.companyId ?? "default";

	function emit(
		eventType: PersistentGraphEvent["eventType"],
		payload: Record<string, unknown>,
	): PersistentGraphEvent {
		return {
			// Globally unique — a per-instance counter collides with rows already
			// in the shared event_log (PK) across requests/instances.
			id: `evt-${globalThis.crypto.randomUUID()}`,
			companyId,
			actorId,
			eventType,
			payload: structuredClone(payload),
			createdAt: new Date().toISOString(),
		};
	}

	async function validateSnapshot(): Promise<void> {
		const nodeList = await repo.listNodes();
		const edgeList = await repo.listEdges();
		const result = validateGraph(
			nodeList as GraphNode[],
			edgeList as GraphEdge[],
		);
		if (!result.ok) {
			const messages = result.issues
				.map((i: ValidationIssue) => i.message)
				.join("; ");
			throw new Error(`Invalid graph state: ${messages}`);
		}
	}

	// --- Node CRUD ---

	async function createNode(
		node: GraphNode | KnowledgeNode,
	): Promise<PersistentGraphEvent> {
		const existing = await repo.readNode(node.id);
		if (existing) throw new Error(`Node already exists: ${node.id}`);
		await repo.createNode(node as GraphNode);
		try {
			await validateSnapshot();
		} catch (e) {
			await repo.deleteNode(node.id);
			throw e;
		}
		const event = emit("graph.node.created", {
			nodeId: node.id,
			after: structuredClone(node),
		});
		await repo.saveEvent(event);
		return event;
	}

	async function readNode(id: string): Promise<GraphNode | undefined> {
		const row = await repo.readNode(id);
		return row ? (structuredClone(row) as unknown as GraphNode) : undefined;
	}

	async function updateNode(
		id: string,
		patch: Partial<GraphNode | KnowledgeNode>,
	): Promise<PersistentGraphEvent> {
		const current = await repo.readNode(id);
		if (!current) throw new Error(`Missing node: ${id}`);
		const before = structuredClone(current);
		await repo.updateNode(id, patch);
		try {
			await validateSnapshot();
		} catch (e) {
			await repo.updateNode(id, before);
			throw e;
		}
		const event = emit("graph.node.updated", {
			nodeId: id,
			before,
			after: structuredClone({ ...current, ...patch }),
		});
		await repo.saveEvent(event);
		return event;
	}

	async function deleteNode(id: string): Promise<PersistentGraphEvent> {
		const current = await repo.readNode(id);
		if (!current) throw new Error(`Missing node: ${id}`);
		const before = structuredClone(current);

		// Cascade: delete edges referencing this node
		const allEdges = await repo.listEdges();
		const cascadedIds: string[] = [];
		for (const e of allEdges) {
			if (e.fromNodeId === id || e.toNodeId === id) {
				cascadedIds.push(e.id);
				await repo.deleteEdge(e.id);
			}
		}

		await repo.deleteNode(id);
		const event = emit("graph.node.deleted", {
			nodeId: id,
			before,
			cascadedEdgeIds: cascadedIds,
		});
		await repo.saveEvent(event);
		return event;
	}

	async function listNodes(): Promise<GraphNode[]> {
		const rows = await repo.listNodes();
		return structuredClone(rows) as unknown as GraphNode[];
	}

	// --- Edge CRUD ---

	async function createEdge(edge: GraphEdge): Promise<PersistentGraphEvent> {
		const existing = await repo.readEdge(edge.id);
		if (existing) throw new Error(`Edge already exists: ${edge.id}`);

		const fromNode = await repo.readNode(edge.fromNodeId);
		const toNode = await repo.readNode(edge.toNodeId);
		if (!fromNode || !toNode) {
			throw new Error(
				`Edge references missing node(s): from=${edge.fromNodeId} to=${edge.toNodeId}`,
			);
		}

		await repo.createEdge(edge);
		try {
			await validateSnapshot();
		} catch (e) {
			await repo.deleteEdge(edge.id);
			throw e;
		}
		const event = emit("graph.edge.created", {
			edgeId: edge.id,
			after: structuredClone(edge),
		});
		await repo.saveEvent(event);
		return event;
	}

	async function readEdge(id: string): Promise<GraphEdge | undefined> {
		const row = await repo.readEdge(id);
		return row ? (structuredClone(row) as unknown as GraphEdge) : undefined;
	}

	async function updateEdge(
		id: string,
		patch: Partial<GraphEdge>,
	): Promise<PersistentGraphEvent> {
		const current = await repo.readEdge(id);
		if (!current) throw new Error(`Missing edge: ${id}`);
		const before = structuredClone(current);
		await repo.updateEdge(id, patch);
		try {
			await validateSnapshot();
		} catch (e) {
			await repo.updateEdge(id, before);
			throw e;
		}
		const event = emit("graph.edge.updated", {
			edgeId: id,
			before,
			after: structuredClone({ ...current, ...patch }),
		});
		await repo.saveEvent(event);
		return event;
	}

	async function deleteEdge(id: string): Promise<PersistentGraphEvent> {
		const current = await repo.readEdge(id);
		if (!current) throw new Error(`Missing edge: ${id}`);
		const before = structuredClone(current);
		await repo.deleteEdge(id);
		const event = emit("graph.edge.deleted", { edgeId: id, before });
		await repo.saveEvent(event);
		return event;
	}

	async function listEdges(): Promise<GraphEdge[]> {
		const rows = await repo.listEdges();
		return structuredClone(rows) as unknown as GraphEdge[];
	}

	// --- Proposal integration ---

	async function applyConfirmedProposals(
		proposals: GraphOperationProposal[],
	): Promise<PersistentGraphEvent[]> {
		const events: PersistentGraphEvent[] = [];
		const existingNodes = new Set((await repo.listNodes()).map((n) => n.id));
		const existingEdges = new Set((await repo.listEdges()).map((e) => e.id));

		for (const proposal of proposals) {
			if (proposal.type === "create_node") {
				if (
					existingNodes.has(proposal.node.id) ||
					existingNodes.has(proposal.node.id)
				) {
					// Idempotent: skip duplicate. But add to set to handle dupes within batch.
					existingNodes.add(proposal.node.id);
					continue;
				}
				existingNodes.add(proposal.node.id);
				events.push(await createNode(proposal.node));
			} else if (proposal.type === "create_edge") {
				if (existingEdges.has(proposal.edge.id)) {
					existingEdges.add(proposal.edge.id);
					continue;
				}
				existingEdges.add(proposal.edge.id);
				events.push(await createEdge(proposal.edge));
			} else if (proposal.type === "update_node") {
				events.push(await updateNode(proposal.nodeId, proposal.patch));
			} else {
				throw new Error(
					`Unknown proposal type: ${(proposal as GraphOperationProposal).type}`,
				);
			}
		}
		return events;
	}

	async function applyProposalsWithDecisions(
		proposals: GraphOperationProposal[],
		decisions: GraphConfirmationDecision[],
	): Promise<PersistentGraphEvent[]> {
		const currentGraph = {
			nodes: (await repo.listNodes()) as GraphNode[],
			edges: (await repo.listEdges()) as GraphEdge[],
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

		const approvedGraph = confirmationResult.graph;
		const approvedNodeIds = new Set(approvedGraph.nodes.map((n) => n.id));
		const approvedEdgeIds = new Set(approvedGraph.edges.map((e) => e.id));

		// Delete edges not in approved graph
		const allEdges = await repo.listEdges();
		for (const e of allEdges) {
			if (!approvedEdgeIds.has(e.id)) {
				await deleteEdge(e.id);
			}
		}

		// Delete nodes not in approved graph
		const allNodes = await repo.listNodes();
		for (const n of allNodes) {
			if (!approvedNodeIds.has(n.id)) {
				await deleteNode(n.id);
			}
		}

		// Apply approved proposals only
		const approvedProposals = proposals.filter(
			(_: GraphOperationProposal, i: number) =>
				decisions[i]?.decision === "approve",
		);

		return applyConfirmedProposals(approvedProposals);
	}

	async function listEvents(): Promise<PersistentGraphEvent[]> {
		const rows = await repo.listEvents();
		return rows.map((r) => structuredClone(r)) as PersistentGraphEvent[];
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
		listEvents,
	};
}
