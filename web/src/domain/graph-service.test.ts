import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode, KnowledgeNode } from "./graph";
import type { GraphOperationProposal } from "./interview";
import { createInterviewSession, answerInterviewQuestion } from "./interview";
import type { GraphConfirmationDecision } from "./graph-confirmation";
import { confirmGraphProposals } from "./graph-confirmation";
import { createGraphService, type GraphServiceEvent } from "./graph-service";

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

describe("Graph Service", () => {
	describe("node CRUD", () => {
		it("creates and reads a node", () => {
			const service = createGraphService();
			const event = service.createNode(person);

			expect(event.eventType).toBe("graph.node.created");
			expect(event.payload.nodeId).toBe(person.id);
			expect(service.readNode(person.id)).toEqual(person);
		});

		it("creates multiple nodes and lists them", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(knowledge);

			expect(service.listNodes()).toHaveLength(2);
			expect(service.listNodes().map((n: GraphNode) => n.id)).toContain(
				person.id,
			);
			expect(service.listNodes().map((n: GraphNode) => n.id)).toContain(
				knowledge.id,
			);
		});

		it("updates a node by merging fields", () => {
			const service = createGraphService();
			service.createNode(person);
			const event = service.updateNode(person.id, { name: "Pedro G." });

			expect(event.eventType).toBe("graph.node.updated");
			expect(event.payload.nodeId).toBe(person.id);
			const updated = service.readNode(person.id);
			expect(updated?.name).toBe("Pedro G.");
			expect(updated?.type).toBe("Person");
		});

		it("rejects update of a missing node", () => {
			const service = createGraphService();
			expect(() => service.updateNode("missing", { name: "X" })).toThrow(
				/missing/i,
			);
		});

		it("validates the graph after node update and rejects invalid changes", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(knowledge);
			service.createEdge(mastery);

			expect(() =>
				service.updateNode(person.id, {
					type: "Department",
				} as unknown as Partial<GraphNode>),
			).toThrow(/invalid/i);
		});

		it("deletes a node and cascades to referencing edges", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(knowledge);
			service.createEdge(mastery);

			const event = service.deleteNode(person.id);

			expect(event.eventType).toBe("graph.node.deleted");
			expect(event.payload.nodeId).toBe(person.id);
			expect(event.payload.cascadedEdgeIds).toEqual([mastery.id]);
			expect(service.readNode(person.id)).toBeUndefined();
			expect(service.readEdge(mastery.id)).toBeUndefined();
			expect(service.listNodes()).toHaveLength(1);
			expect(service.listEdges()).toHaveLength(0);
		});

		it("deletes a node with no referencing edges", () => {
			const service = createGraphService();
			service.createNode(person);

			const event = service.deleteNode(person.id);

			expect(event.eventType).toBe("graph.node.deleted");
			expect(event.payload.cascadedEdgeIds).toEqual([]);
			expect(service.listNodes()).toHaveLength(0);
		});

		it("rejects delete of a missing node", () => {
			const service = createGraphService();
			expect(() => service.deleteNode("missing")).toThrow(/missing/i);
		});

		it("rejects creating a node with unknown type", () => {
			const service = createGraphService();
			expect(() =>
				service.createNode({
					id: "bad",
					type: "Department",
					name: "X",
				} as unknown as GraphNode),
			).toThrow(/invalid/i);
		});

		it("rejects creating a duplicate node by id", () => {
			const service = createGraphService();
			service.createNode(person);
			expect(() => service.createNode(person)).toThrow(/already exists/i);
		});
	});

	describe("edge CRUD", () => {
		it("creates and reads an edge", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(knowledge);
			const event = service.createEdge(mastery);

			expect(event.eventType).toBe("graph.edge.created");
			expect(event.payload.edgeId).toBe(mastery.id);
			expect(service.readEdge(mastery.id)).toEqual(mastery);
		});

		it("lists edges", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(knowledge);
			service.createNode(processNode);
			service.createEdge(mastery);
			service.createEdge(requires);

			expect(service.listEdges()).toHaveLength(2);
		});

		it("updates an edge by merging attributes", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(knowledge);
			service.createEdge(mastery);

			const event = service.updateEdge(mastery.id, {
				attributes: { level: 3 },
			});

			expect(event.eventType).toBe("graph.edge.updated");
			expect(event.payload.edgeId).toBe(mastery.id);
			const updated = service.readEdge(mastery.id);
			expect(updated?.attributes).toEqual({ level: 3 });
		});

		it("rejects update of a missing edge", () => {
			const service = createGraphService();
			expect(() => service.updateEdge("missing", { attributes: {} })).toThrow(
				/missing/i,
			);
		});

		it("deletes an edge without cascading", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(knowledge);
			service.createEdge(mastery);

			const event = service.deleteEdge(mastery.id);

			expect(event.eventType).toBe("graph.edge.deleted");
			expect(event.payload.edgeId).toBe(mastery.id);
			expect(service.readEdge(mastery.id)).toBeUndefined();
			expect(service.listNodes()).toHaveLength(2);
		});

		it("rejects delete of a missing edge", () => {
			const service = createGraphService();
			expect(() => service.deleteEdge("missing")).toThrow(/missing/i);
		});

		it("rejects creating an edge to missing nodes", () => {
			const service = createGraphService();
			expect(() => service.createEdge(mastery)).toThrow(/missing/i);
		});

		it("rejects creating an edge with invalid endpoints", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(processNode);

			const invalidEdge: GraphEdge = {
				id: "edge-bad",
				type: "MASTERS",
				fromNodeId: person.id,
				toNodeId: processNode.id,
				attributes: {},
			};

			expect(() => service.createEdge(invalidEdge)).toThrow(/invalid/i);
		});

		it("rejects creating a duplicate edge by id", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(knowledge);
			service.createEdge(mastery);

			expect(() => service.createEdge(mastery)).toThrow(/already exists/i);
		});

		it("validates edge endpoints after update and rejects invalid changes", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(knowledge);
			service.createNode(processNode);
			service.createEdge(mastery);
			service.createEdge(requires);

			expect(() =>
				service.updateEdge(mastery.id, { toNodeId: processNode.id }),
			).toThrow(/invalid/i);
		});
	});

	describe("event log", () => {
		it("appends events for every mutation in order", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(knowledge);
			service.createEdge(mastery);
			service.updateNode(person.id, { name: "Pedro G." });
			service.deleteEdge(mastery.id);

			const log = service.eventLog();
			expect(log).toHaveLength(5);
			expect(log[0].eventType).toBe("graph.node.created");
			expect(log[1].eventType).toBe("graph.node.created");
			expect(log[2].eventType).toBe("graph.edge.created");
			expect(log[3].eventType).toBe("graph.node.updated");
			expect(log[4].eventType).toBe("graph.edge.deleted");
		});

		it("includes actor, companyId, before/after, and timestamp in events", () => {
			const service = createGraphService({
				actorId: "actor-1",
				companyId: "company-1",
			});
			const event = service.createNode(person);

			expect(event.actorId).toBe("actor-1");
			expect(event.companyId).toBe("company-1");
			expect(event.payload.before).toBeUndefined();
			expect(event.payload.after).toEqual(person);
			expect(typeof event.createdAt).toBe("string");
		});

		it("includes before and after in update events", () => {
			const service = createGraphService({ actorId: "actor-1" });
			service.createNode(person);
			const event = service.updateNode(person.id, { name: "Pedro G." });

			expect(event.payload.before).toEqual(person);
			expect(event.payload.after).toEqual(
				expect.objectContaining({
					id: person.id,
					name: "Pedro G.",
					type: "Person",
				}),
			);
		});

		it("includes cascaded edges and before in node delete events", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(knowledge);
			service.createEdge(mastery);
			const event = service.deleteNode(person.id);

			expect(event.payload.cascadedEdgeIds).toEqual([mastery.id]);
			expect(event.payload.before).toEqual(person);
		});

		it("does not record events for rejected operations", () => {
			const service = createGraphService();
			service.createNode(person);
			expect(() => service.createNode(person)).toThrow();

			expect(service.eventLog()).toHaveLength(1);
		});

		it("event log is append-only and cannot be externally modified", () => {
			const service = createGraphService();
			service.createNode(person);
			const log = service.eventLog();
			expect(log).toHaveLength(1);
		});
	});

	describe("immutability", () => {
		it("returns copies of nodes from reads and lists", () => {
			const service = createGraphService();
			service.createNode(person);
			const readNode = service.readNode(person.id)!;
			readNode.name = "Mutated";
			expect(service.readNode(person.id)!.name).toBe("Pedro");
		});

		it("returns copies of edges from reads and lists", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(knowledge);
			service.createEdge(mastery);
			const readEdge = service.readEdge(mastery.id)!;
			readEdge.type = "LEARNS" as unknown as GraphEdge["type"];
			expect(service.readEdge(mastery.id)!.type).toBe("MASTERS");
		});

		it("event log entries are copies and cannot mutate internal state", () => {
			const service = createGraphService();
			service.createNode(person);
			const logEntry = service.eventLog()[0];
			(logEntry.payload as Record<string, unknown>).nodeId = "hacked";
			expect(
				(service.eventLog()[0].payload as Record<string, unknown>).nodeId,
			).toBe(person.id);
		});
	});

	describe("proposal integration", () => {
		it("applies confirmed proposals through applyConfirmedProposals", () => {
			const service = createGraphService();
			const proposals: GraphOperationProposal[] = [
				{ type: "create_node", node: person, reason: "key person" },
				{ type: "create_node", node: knowledge, reason: "critical knowledge" },
				{ type: "create_edge", edge: mastery, reason: "expert mastery" },
			];

			const events = service.applyConfirmedProposals(proposals);
			expect(events).toHaveLength(3);
			expect(events.map((e: GraphServiceEvent) => e.eventType)).toEqual([
				"graph.node.created",
				"graph.node.created",
				"graph.edge.created",
			]);
			expect(service.listNodes()).toHaveLength(2);
			expect(service.listEdges()).toHaveLength(1);
		});

		it("applies update proposals from the confirmation layer", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(knowledge);

			const proposals: GraphOperationProposal[] = [
				{
					type: "update_node",
					nodeId: person.id,
					patch: { name: "Pedro G." },
					reason: "rename",
				},
			];

			const events = service.applyConfirmedProposals(proposals);
			expect(events).toHaveLength(1);
			expect(events[0].eventType).toBe("graph.node.updated");
			expect(service.readNode(person.id)?.name).toBe("Pedro G.");
		});

		it("rolls back a confirmed proposal batch when a later proposal fails", () => {
			const service = createGraphService();
			const newNode: GraphNode = {
				id: "node-new",
				type: "Person",
				name: "New",
			};
			const proposals: GraphOperationProposal[] = [
				{ type: "create_node", node: newNode, reason: "new" },
				{
					type: "update_node",
					nodeId: "missing-node",
					patch: { name: "Missing" },
					reason: "bad update",
				},
			];

			expect(() => service.applyConfirmedProposals(proposals)).toThrow(
				/missing node/i,
			);
			expect(service.readNode(newNode.id)).toBeUndefined();
			expect(service.eventLog()).toHaveLength(0);
		});

		it("still applies every event in a successful confirmed proposal batch", () => {
			const service = createGraphService();
			const proposals: GraphOperationProposal[] = [
				{ type: "create_node", node: person, reason: "person" },
				{ type: "create_node", node: knowledge, reason: "knowledge" },
			];

			const events = service.applyConfirmedProposals(proposals);

			expect(events).toHaveLength(2);
			expect(service.listNodes()).toHaveLength(2);
		});

		it("rejects proposals that would leave the graph invalid", () => {
			const service = createGraphService();

			const proposals: GraphOperationProposal[] = [
				{ type: "create_node", node: person, reason: "key person" },
				{
					type: "create_edge",
					edge: {
						id: "edge-bad",
						type: "MASTERS",
						fromNodeId: person.id,
						toNodeId: processNode.id,
						attributes: {},
					},
					reason: "bad endpoint",
				},
			];

			const decisions: GraphConfirmationDecision[] = [
				{ proposalIndex: 0, decision: "approve" },
				{ proposalIndex: 1, decision: "approve" },
			];

			expect(() =>
				service.applyProposalsWithDecisions(proposals, decisions),
			).toThrow(/invalid/i);
			expect(service.listNodes()).toHaveLength(0);
		});

		it("rolls back all changes when proposals fail validation", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(knowledge);
			service.createEdge(mastery);

			const proposals: GraphOperationProposal[] = [
				{
					type: "update_node",
					nodeId: person.id,
					patch: { type: "Department" } as unknown as Partial<GraphNode>,
					reason: "invalid update",
				},
			];

			const decisions: GraphConfirmationDecision[] = [
				{ proposalIndex: 0, decision: "approve" },
			];

			expect(() =>
				service.applyProposalsWithDecisions(proposals, decisions),
			).toThrow();
			expect(service.readNode(person.id)?.name).toBe("Pedro");
			expect(service.listNodes()).toHaveLength(2);
		});

		it("applies only approved proposals and skips rejected ones", () => {
			const service = createGraphService();

			const proposals: GraphOperationProposal[] = [
				{ type: "create_node", node: person, reason: "key person" },
				{ type: "create_node", node: knowledge, reason: "critical knowledge" },
			];

			const decisions: GraphConfirmationDecision[] = [
				{ proposalIndex: 0, decision: "approve" },
				{ proposalIndex: 1, decision: "reject", reason: "not needed" },
			];

			const events = service.applyProposalsWithDecisions(proposals, decisions);
			expect(events).toHaveLength(1);
			expect(events[0].eventType).toBe("graph.node.created");
			expect(service.listNodes()).toHaveLength(1);
		});

		it("integrates end-to-end with interview and confirmation", () => {
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

			const approvedDecisions: GraphConfirmationDecision[] =
				session.proposals.map((_: GraphOperationProposal, i: number) => ({
					proposalIndex: i,
					decision: "approve" as const,
				}));

			const confirmationResult = confirmGraphProposals({
				proposals: session.proposals,
				decisions: approvedDecisions,
			});
			expect(confirmationResult.ok).toBe(true);

			// Apply the confirmed proposals to the graph service
			const service = createGraphService();
			const events = service.applyConfirmedProposals(session.proposals);
			expect(events.length).toBeGreaterThanOrEqual(3);

			expect(service.listNodes().length).toBeGreaterThanOrEqual(2);
			expect(service.listEdges().length).toBeGreaterThanOrEqual(1);
		});

		it("does not throw when an approved create duplicates an existing node (idempotent)", () => {
			const service = createGraphService();
			service.createNode(person);

			const proposals: GraphOperationProposal[] = [
				{ type: "create_node", node: person, reason: "dup" },
			];
			const decisions: GraphConfirmationDecision[] = [
				{ proposalIndex: 0, decision: "approve" },
			];

			expect(() =>
				service.applyProposalsWithDecisions(proposals, decisions),
			).not.toThrow();
			expect(service.listNodes()).toHaveLength(1);
			expect(service.readNode(person.id)).toEqual(person);
		});

		it("does not throw when an approved create duplicates an existing edge (idempotent)", () => {
			const service = createGraphService();
			service.createNode(person);
			service.createNode(knowledge);
			service.createEdge(mastery);

			const proposals: GraphOperationProposal[] = [
				{ type: "create_edge", edge: mastery, reason: "dup" },
			];
			const decisions: GraphConfirmationDecision[] = [
				{ proposalIndex: 0, decision: "approve" },
			];

			expect(() =>
				service.applyProposalsWithDecisions(proposals, decisions),
			).not.toThrow();
			expect(service.listEdges()).toHaveLength(1);
		});
	});
});
