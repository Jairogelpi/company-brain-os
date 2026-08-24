import { requireOrganizationId } from "@/auth/organization-context";
import type { AssertionRepository } from "@/db/assertion-repository";
import type { GraphRepository } from "@/db/repository";
import type { Assertion } from "./assertions";
import type { GraphConfirmationDecision } from "./graph-confirmation";
import { confirmGraphProposals } from "./graph-confirmation";
import { ENTITY_PREDICATES } from "./graph-projection";
import { rebuildApprovedAssertionProjection } from "./assertion-projection-service";
import type { GraphEdge, GraphNode, KnowledgeNode } from "./graph";
import type { GraphOperationProposal } from "./interview";

export type CanonicalWriteEvent = {
	id: string;
	companyId: string;
	actorId: string;
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

export type CanonicalGraphWriter = {
	createNode(node: GraphNode | KnowledgeNode): Promise<CanonicalWriteEvent>;
	updateNode(id: string, patch: Partial<GraphNode | KnowledgeNode>): Promise<CanonicalWriteEvent>;
	deleteNode(id: string): Promise<CanonicalWriteEvent>;
	createEdge(edge: GraphEdge): Promise<CanonicalWriteEvent>;
	updateEdge(id: string, patch: Partial<GraphEdge>): Promise<CanonicalWriteEvent>;
	deleteEdge(id: string): Promise<CanonicalWriteEvent>;
	applyProposalsWithDecisions(
		proposals: GraphOperationProposal[],
		decisions: GraphConfirmationDecision[],
	): Promise<CanonicalWriteEvent[]>;
};

type WriterOptions = {
	organizationId: string;
	actorId: string;
	sourceType?: string;
	sourceId?: string;
	now?: () => string;
	id?: () => string;
};

function eventTypeFor(proposal: GraphOperationProposal): CanonicalWriteEvent["eventType"] {
	if (proposal.type === "create_node") return "graph.node.created";
	if (proposal.type === "update_node") return "graph.node.updated";
	return "graph.edge.created";
}

export function createCanonicalGraphWriter(
	ledger: AssertionRepository,
	graph: GraphRepository,
	options: WriterOptions,
): CanonicalGraphWriter {
	const organizationId = requireOrganizationId(options.organizationId);
	const actorId = options.actorId.trim();
	if (!actorId) throw new Error("actorId is required for canonical writes");
	const now = options.now ?? (() => new Date().toISOString());
	const nextId = options.id ?? (() => globalThis.crypto.randomUUID());
	const sourceType = options.sourceType ?? "human_graph_edit";
	const sourceId = options.sourceId ?? `request:${nextId()}`;

	function approvedAssertion(input: {
		subjectEntityId: string;
		predicate: string;
		objectEntityId?: string;
		scalarValue?: string | number | boolean | null;
		metadata?: Record<string, unknown>;
	}): Assertion {
		return {
			id: `assertion-${nextId()}`,
			organizationId,
			...input,
			sourceType,
			sourceId,
			status: "approved",
			proposedBy: actorId,
			approvedBy: actorId,
			recordedAt: now(),
			confidenceClass: "verified",
			metadata: input.metadata ?? {},
		};
	}

	function nodeAssertions(node: Partial<GraphNode | KnowledgeNode> & { id: string }): Assertion[] {
		const claims: Assertion[] = [];
		if (node.type) claims.push(approvedAssertion({
			subjectEntityId: node.id,
			predicate: ENTITY_PREDICATES.type,
			scalarValue: node.type,
		}));
		if (node.name !== undefined) claims.push(approvedAssertion({
			subjectEntityId: node.id,
			predicate: ENTITY_PREDICATES.name,
			scalarValue: node.name,
		}));
		if (node.criticality !== undefined) claims.push(approvedAssertion({
			subjectEntityId: node.id,
			predicate: ENTITY_PREDICATES.criticality,
			scalarValue: node.criticality,
		}));
		if (node.attributes !== undefined) claims.push(approvedAssertion({
			subjectEntityId: node.id,
			predicate: ENTITY_PREDICATES.attributes,
			scalarValue: true,
			metadata: { nodeAttributes: node.attributes },
		}));
		if (
			node.type === "Knowledge" ||
			"knowledgeType" in node ||
			"documented" in node ||
			"validationState" in node ||
			"confidence" in node
		) {
			const knowledge = node as Partial<KnowledgeNode> & { id: string };
			if (knowledge.knowledgeType !== undefined) claims.push(approvedAssertion({ subjectEntityId: node.id, predicate: ENTITY_PREDICATES.knowledgeType, scalarValue: knowledge.knowledgeType }));
			if (knowledge.documented !== undefined) claims.push(approvedAssertion({ subjectEntityId: node.id, predicate: ENTITY_PREDICATES.documented, scalarValue: knowledge.documented }));
			if (knowledge.validationState !== undefined) claims.push(approvedAssertion({ subjectEntityId: node.id, predicate: ENTITY_PREDICATES.validationState, scalarValue: knowledge.validationState }));
			if (knowledge.confidence !== undefined) claims.push(approvedAssertion({ subjectEntityId: node.id, predicate: ENTITY_PREDICATES.confidence, scalarValue: knowledge.confidence }));
		}
		return claims;
	}

	function edgeAssertion(edge: GraphEdge): Assertion {
		return approvedAssertion({
			subjectEntityId: edge.fromNodeId,
			predicate: edge.type,
			objectEntityId: edge.toNodeId,
			metadata: { originalEdgeId: edge.id, edgeAttributes: edge.attributes ?? {} },
		});
	}

	async function persist(assertions: Assertion[]): Promise<void> {
		await ledger.createBatch(assertions);
		await rebuildApprovedAssertionProjection(ledger, graph, organizationId);
	}

	function event(eventType: CanonicalWriteEvent["eventType"], payload: Record<string, unknown>): CanonicalWriteEvent {
		return {
			id: `evt-${nextId()}`,
			companyId: organizationId,
			actorId,
			eventType,
			payload,
			createdAt: now(),
		};
	}

	async function applyApprovedProposals(proposals: GraphOperationProposal[]): Promise<CanonicalWriteEvent[]> {
		const assertions: Assertion[] = [];
		for (const proposal of proposals) {
			if (proposal.type === "create_node") assertions.push(...nodeAssertions(proposal.node));
			if (proposal.type === "update_node") assertions.push(...nodeAssertions({ id: proposal.nodeId, ...proposal.patch }));
			if (proposal.type === "create_edge") assertions.push(edgeAssertion(proposal.edge));
		}
		await persist(assertions);
		return proposals.map((proposal) => event(eventTypeFor(proposal), { proposal }));
	}

	return {
		async createNode(node) {
			if (await graph.readNode(node.id)) throw new Error(`Node already exists: ${node.id}`);
			const [writeEvent] = await applyApprovedProposals([{ type: "create_node", node, reason: "Human-confirmed graph edit" }]);
			return writeEvent;
		},
		async updateNode(id, patch) {
			if (!await graph.readNode(id)) throw new Error(`Missing node: ${id}`);
			const [writeEvent] = await applyApprovedProposals([{ type: "update_node", nodeId: id, patch, reason: "Human-confirmed graph edit" }]);
			return writeEvent;
		},
		async deleteNode(id) {
			if (!await graph.readNode(id)) throw new Error(`Missing node: ${id}`);
			const active = await ledger.listByOrganization(organizationId);
			for (const assertion of active) {
				if (assertion.status === "approved" && (assertion.subjectEntityId === id || assertion.objectEntityId === id)) {
					await ledger.transition(assertion.id, "archived", actorId);
				}
			}
			await rebuildApprovedAssertionProjection(ledger, graph, organizationId);
			return event("graph.node.deleted", { nodeId: id });
		},
		async createEdge(edge) {
			const [writeEvent] = await applyApprovedProposals([{ type: "create_edge", edge, reason: "Human-confirmed graph edit" }]);
			return writeEvent;
		},
		async updateEdge(id, patch) {
			const current = await graph.readEdge(id);
			if (!current) throw new Error(`Missing edge: ${id}`);
			const assertionId = typeof current.attributes?.assertionId === "string" ? current.attributes.assertionId : undefined;
			if (!assertionId) throw new Error(`Edge has no canonical assertion: ${id}`);
			await ledger.transition(assertionId, "superseded", actorId);
			await persist([edgeAssertion({ ...current, ...patch } as GraphEdge)]);
			return event("graph.edge.updated", { edgeId: id });
		},
		async deleteEdge(id) {
			const current = await graph.readEdge(id);
			if (!current) throw new Error(`Missing edge: ${id}`);
			const assertionId = typeof current.attributes?.assertionId === "string" ? current.attributes.assertionId : undefined;
			if (!assertionId) throw new Error(`Edge has no canonical assertion: ${id}`);
			await ledger.transition(assertionId, "archived", actorId);
			await rebuildApprovedAssertionProjection(ledger, graph, organizationId);
			return event("graph.edge.deleted", { edgeId: id });
		},
		async applyProposalsWithDecisions(proposals, decisions) {
			const currentGraph = {
				nodes: await graph.listNodes() as GraphNode[],
				edges: await graph.listEdges() as GraphEdge[],
			};
			const confirmation = confirmGraphProposals({ currentGraph, proposals, decisions, companyId: organizationId });
			if (!confirmation.ok) {
				throw new Error(`Invalid proposals: ${confirmation.issues.map((issue) => issue.message).join("; ")}`);
			}
			const decisionsByIndex = new Map(
				decisions.map((decision) => [decision.proposalIndex, decision]),
			);
			const approved = proposals.filter(
				(_, index) => decisionsByIndex.get(index)?.decision === "approve",
			);
			return applyApprovedProposals(approved);
		},
	};
}
