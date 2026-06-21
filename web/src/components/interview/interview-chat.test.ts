import { describe, expect, it } from "vitest";
import type { GraphNode, KnowledgeNode } from "@/domain/graph";
import type { GraphOperationProposal } from "@/domain/interview";
import {
	createInterviewSession,
	answerInterviewQuestion,
} from "@/domain/interview";
import type { GraphConfirmationDecision } from "@/domain/graph-confirmation";
import {
	createGraphService,
	type GraphService,
	type GraphServiceEvent,
} from "@/domain/graph-service";

const person: GraphNode = {
	id: "node-person-test",
	type: "Person",
	name: "Test Person",
};
const knowledge: KnowledgeNode = {
	id: "node-knowledge-test",
	type: "Knowledge",
	name: "test knowledge",
	knowledgeType: "technical",
	documented: false,
	validationState: "proposed",
	confidence: 25,
	criticality: "high",
};

function makeService(): GraphService {
	return createGraphService({ actorId: "tester", companyId: "test-corp" });
}

describe("F4 canvas ↔ chat sync logic", () => {
	it("canvas node creation appears in service event log visible to chat panel", () => {
		const service = makeService();

		// Canvas creates a node (simulating tldraw side effect)
		const event = service.createNode(person);

		// Chat panel reads the event log and sees the creation
		const events = service.eventLog();
		expect(events).toHaveLength(1);
		expect(events[0].eventType).toBe("graph.node.created");
		expect(events[0].payload.nodeId).toBe(person.id);
		expect(event.id).toBe(events[0].id);
	});

	it("interview proposals applied to service update canvas sync trigger (event count)", () => {
		const service = makeService();

		// Run a mini interview
		let session = createInterviewSession();
		session = answerInterviewQuestion(
			session,
			"Pedro es indispensable; si falta se para producción.",
		);
		session = answerInterviewQuestion(
			session,
			"Solo Pedro configura la llenadora crítica y nadie más sabe hacerlo.",
		);

		// Confirm and apply proposals
		const allApproved: GraphConfirmationDecision[] = session.proposals.map(
			(_, i) => ({
				proposalIndex: i,
				decision: "approve" as const,
			}),
		);

		const eventsBefore = service.eventLog().length;

		service.applyProposalsWithDecisions(session.proposals, allApproved);

		const eventsAfter = service.eventLog().length;
		// Event log grew — canvas can detect this and re-sync
		expect(eventsAfter).toBeGreaterThan(eventsBefore);
	});

	it("canvas and interview mutations accumulate in a single event log", () => {
		const service = makeService();

		// Canvas action
		service.createNode(person);

		// Interview action
		let session = createInterviewSession();
		session = answerInterviewQuestion(
			session,
			"Pedro es indispensable; si falta se para producción.",
		);
		const allApproved: GraphConfirmationDecision[] = session.proposals.map(
			(_, i) => ({
				proposalIndex: i,
				decision: "approve" as const,
			}),
		);

		service.applyProposalsWithDecisions(session.proposals, allApproved);

		const events = service.eventLog();

		// Both canvas and interview events are present
		const types = events.map((e) => e.eventType);
		expect(types).toContain("graph.node.created"); // canvas
		expect(
			types.filter((t) => t.startsWith("graph.")).length,
		).toBeGreaterThanOrEqual(2);
	});

	it("idempotent: applying interview proposals to service that already has nodes does not throw", () => {
		const service = makeService();

		// Pre-populate via canvas
		service.createNode(person);

		// Interview also proposes the same node
		const proposals: GraphOperationProposal[] = [
			{ type: "create_node", node: person, reason: "dup from interview" },
		];
		const decisions: GraphConfirmationDecision[] = [
			{ proposalIndex: 0, decision: "approve" },
		];

		expect(() =>
			service.applyProposalsWithDecisions(proposals, decisions),
		).not.toThrow();
	});

	it("service event log length increases after canvas delete", () => {
		const service = makeService();
		service.createNode(person);

		const before = service.eventLog().length;
		service.deleteNode(person.id);
		const after = service.eventLog().length;

		expect(after).toBeGreaterThan(before);
		expect(service.readNode(person.id)).toBeUndefined();
	});

	it("full round-trip: canvas edit → interview proposals → same service → no data loss", () => {
		const service = makeService();

		// 1. Canvas creates a node
		service.createNode(person);
		expect(service.listNodes()).toHaveLength(1);

		// 2. Interview runs and proposes new knowledge + edge
		let session = createInterviewSession();
		session = answerInterviewQuestion(
			session,
			"Pedro es indispensable; si falta se para producción.",
		);
		session = answerInterviewQuestion(
			session,
			"Solo Pedro configura la llenadora crítica y nadie más sabe hacerlo.",
		);

		const allApproved: GraphConfirmationDecision[] = session.proposals.map(
			(_, i) => ({
				proposalIndex: i,
				decision: "approve" as const,
			}),
		);

		service.applyProposalsWithDecisions(session.proposals, allApproved);

		// 3. Verify both canvas and interview data coexist
		expect(service.readNode(person.id)).toBeDefined(); // canvas data preserved
		expect(service.listNodes().length).toBeGreaterThanOrEqual(2); // interview data added
		expect(service.listEdges().length).toBeGreaterThanOrEqual(1); // edges from interview
	});
});
