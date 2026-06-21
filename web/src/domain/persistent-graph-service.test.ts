import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode, KnowledgeNode } from "@/domain/graph";
import type { GraphOperationProposal } from "./interview";
import { createInterviewSession, answerInterviewQuestion } from "./interview";
import type { GraphConfirmationDecision } from "./graph-confirmation";
import { createInMemoryGraphRepository } from "@/db/repository";
import {
	createPersistentGraphService,
	type PersistentGraphService,
} from "./persistent-graph-service";

describe("event ids", () => {
	it("are unique across separate service instances (shared event_log PK)", async () => {
		const n = (id: string): GraphNode => ({ id, type: "Person", name: id });
		const a = createPersistentGraphService(createInMemoryGraphRepository());
		const b = createPersistentGraphService(createInMemoryGraphRepository());
		const e1 = await a.createNode(n("p1"));
		const e2 = await b.createNode(n("p2"));
		// A per-instance counter would make both "evt-1" → DB PK collision.
		expect(e1.id).not.toBe(e2.id);
	});
});

const person: GraphNode = {
	id: "node-person-pedro",
	type: "Person",
	name: "Pedro",
};
const knowledge: KnowledgeNode = {
	id: "node-knowledge-filler",
	type: "Knowledge",
	name: "configurar llenadora",
	knowledgeType: "technical",
	documented: false,
	validationState: "proposed",
	confidence: 25,
	criticality: "high",
};
const processNode: GraphNode = {
	id: "node-process-production",
	type: "Process",
	name: "Production",
};
const mastery: GraphEdge = {
	id: "edge-masters-pedro-filler",
	type: "MASTERS",
	fromNodeId: person.id,
	toNodeId: knowledge.id,
	attributes: { level: 5 },
};
const requires: GraphEdge = {
	id: "edge-requires-production-filler",
	type: "REQUIRES",
	fromNodeId: processNode.id,
	toNodeId: knowledge.id,
};

function makeService(): PersistentGraphService {
	return createPersistentGraphService(createInMemoryGraphRepository(), {
		actorId: "test",
		companyId: "test-corp",
	});
}

describe("PersistentGraphService (in-memory repo)", () => {
	describe("node CRUD", () => {
		it("creates and reads a node", async () => {
			const service = makeService();
			const event = await service.createNode(person);

			expect(event.eventType).toBe("graph.node.created");
			expect(event.payload.nodeId).toBe(person.id);

			const node = await service.readNode(person.id);
			expect(node?.name).toBe("Pedro");
		});

		it("lists all nodes", async () => {
			const service = makeService();
			await service.createNode(person);
			await service.createNode(knowledge);

			const nodes = await service.listNodes();
			expect(nodes).toHaveLength(2);
		});

		it("throws on duplicate create", async () => {
			const service = makeService();
			await service.createNode(person);
			await expect(service.createNode(person)).rejects.toThrow(
				/already exists/i,
			);
		});

		it("updates a node name", async () => {
			const service = makeService();
			await service.createNode(person);
			const event = await service.updateNode(person.id, {
				name: "Pedro Modificado",
			});

			expect(event.eventType).toBe("graph.node.updated");
			expect(event.payload.before).toBeDefined();
			expect(event.payload.after).toBeDefined();

			const node = await service.readNode(person.id);
			expect(node?.name).toBe("Pedro Modificado");
		});

		it("throws on update of missing node", async () => {
			const service = makeService();
			await expect(
				service.updateNode("missing", { name: "x" }),
			).rejects.toThrow(/missing node/i);
		});

		it("deletes a node with cascade and emits event", async () => {
			const service = makeService();
			await service.createNode(person);
			await service.createNode(knowledge);
			await service.createEdge(mastery);

			const event = await service.deleteNode(person.id);
			expect(event.eventType).toBe("graph.node.deleted");
			expect(
				(event.payload as { cascadedEdgeIds?: string[] }).cascadedEdgeIds,
			).toContain(mastery.id);

			expect(await service.readNode(person.id)).toBeUndefined();
			expect(await service.readEdge(mastery.id)).toBeUndefined();
		});
	});

	describe("edge CRUD", () => {
		it("creates and reads an edge", async () => {
			const service = makeService();
			await service.createNode(person);
			await service.createNode(knowledge);

			const event = await service.createEdge(mastery);
			expect(event.eventType).toBe("graph.edge.created");

			const edge = await service.readEdge(mastery.id);
			expect(edge?.type).toBe("MASTERS");
		});

		it("throws creating edge with missing endpoints", async () => {
			const service = makeService();
			await service.createNode(person);

			await expect(service.createEdge(mastery)).rejects.toThrow(
				/missing node/i,
			);
		});

		it("updates edge attributes", async () => {
			const service = makeService();
			await service.createNode(person);
			await service.createNode(knowledge);
			await service.createEdge(mastery);

			await service.updateEdge(mastery.id, { attributes: { level: 3 } });
			const edge = await service.readEdge(mastery.id);
			expect(edge?.attributes?.level).toBe(3);
		});

		it("deletes an edge", async () => {
			const service = makeService();
			await service.createNode(person);
			await service.createNode(knowledge);
			await service.createEdge(mastery);

			await service.deleteEdge(mastery.id);
			expect(await service.readEdge(mastery.id)).toBeUndefined();
		});

		it("lists all edges", async () => {
			const service = makeService();
			await service.createNode(person);
			await service.createNode(knowledge);
			await service.createNode(processNode);
			await service.createEdge(mastery);
			await service.createEdge(requires);

			const edges = await service.listEdges();
			expect(edges).toHaveLength(2);
		});
	});

	describe("event log", () => {
		it("saves and lists events in order", async () => {
			const service = makeService();
			await service.createNode(person);
			await service.createNode(knowledge);
			await service.createEdge(mastery);

			const events = await service.listEvents();
			expect(events.length).toBeGreaterThanOrEqual(3);
			expect(events[0].eventType).toBe("graph.node.created");
		});

		it("records delete cascade in event payload", async () => {
			const service = makeService();
			await service.createNode(person);
			await service.createNode(knowledge);
			await service.createEdge(mastery);

			await service.deleteNode(person.id);
			const events = await service.listEvents();
			const deleteEvent = events.find(
				(e) => e.eventType === "graph.node.deleted",
			);
			expect(deleteEvent).toBeDefined();
			expect(
				(deleteEvent?.payload as { cascadedEdgeIds?: string[] })
					.cascadedEdgeIds,
			).toContain(mastery.id);
		});
	});

	describe("proposal integration", () => {
		it("applies approved proposals only", async () => {
			const service = makeService();

			const proposals: GraphOperationProposal[] = [
				{ type: "create_node", node: person, reason: "key" },
				{ type: "create_node", node: knowledge, reason: "knowledge" },
			];
			const decisions: GraphConfirmationDecision[] = [
				{ proposalIndex: 0, decision: "approve" },
				{ proposalIndex: 1, decision: "reject", reason: "no" },
			];

			const events = await service.applyProposalsWithDecisions(
				proposals,
				decisions,
			);
			expect(events).toHaveLength(1);
			expect(await service.listNodes()).toHaveLength(1);
		});

		it("does not throw on idempotent duplicate create", async () => {
			const service = makeService();
			await service.createNode(person);

			const proposals: GraphOperationProposal[] = [
				{ type: "create_node", node: person, reason: "dup" },
			];
			const decisions: GraphConfirmationDecision[] = [
				{ proposalIndex: 0, decision: "approve" },
			];

			await expect(
				service.applyProposalsWithDecisions(proposals, decisions),
			).resolves.not.toThrow();
		});

		it("integrates end-to-end with interview engine", async () => {
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

			const allApproved = session.proposals.map((_, i) => ({
				proposalIndex: i,
				decision: "approve" as const,
			}));

			const service = makeService();
			const events = await service.applyProposalsWithDecisions(
				session.proposals,
				allApproved,
			);

			expect(events.length).toBeGreaterThanOrEqual(3);
			expect((await service.listNodes()).length).toBeGreaterThanOrEqual(2);
			expect((await service.listEdges()).length).toBeGreaterThanOrEqual(1);
		});
	});
});
