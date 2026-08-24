import { describe, expect, it } from "vitest";
import { createInMemoryAssertionRepository } from "@/db/assertion-repository";
import { createInMemoryGraphRepository } from "@/db/repository";
import { createCanonicalGraphWriter } from "./canonical-graph-writer";

function harness() {
	const ledger = createInMemoryAssertionRepository();
	const graph = createInMemoryGraphRepository();
	let sequence = 0;
	const writer = createCanonicalGraphWriter(ledger, graph, {
		organizationId: "org-1",
		actorId: "validator-1",
		sourceType: "test",
		sourceId: "canonical-flow",
		now: () => `2026-08-01T00:00:${String(sequence).padStart(2, "0")}.000Z`,
		id: () => `id-${++sequence}`,
	});
	return { ledger, graph, writer };
}

describe("canonical graph writer", () => {
	it("writes human graph edits as approved assertions and only then rebuilds the projection", async () => {
		const { ledger, graph, writer } = harness();
		await writer.createNode({ id: "pedro", type: "Person", name: "Pedro" });
		await writer.createNode({
			id: "line-config",
			type: "Knowledge",
			name: "Line configuration",
			knowledgeType: "technical",
			documented: false,
			validationState: "validated",
			confidence: 90,
			criticality: "high",
		});
		await writer.createEdge({
			id: "legacy-ui-id",
			type: "MASTERS",
			fromNodeId: "pedro",
			toNodeId: "line-config",
			attributes: { level: 5 },
		});

		const assertions = await ledger.listByOrganization("org-1");
		expect(assertions.every((item) => item.status === "approved" && item.approvedBy === "validator-1")).toBe(true);
		expect((await graph.listEdges())[0]).toEqual(expect.objectContaining({
			id: expect.stringMatching(/^assertion:/),
			attributes: expect.objectContaining({ assertionId: expect.any(String), level: 5 }),
		}));
	});

	it("archives canonical assertions instead of directly deleting projection truth", async () => {
		const { ledger, graph, writer } = harness();
		await writer.createNode({ id: "pedro", type: "Person", name: "Pedro" });
		await writer.deleteNode("pedro");

		expect(await graph.listNodes()).toEqual([]);
		expect((await ledger.listByOrganization("org-1")).every((item) => item.status === "archived")).toBe(true);
	});

	it("does not persist proposals rejected by the human reviewer", async () => {
		const { ledger, graph, writer } = harness();
		const proposals = [
			{ type: "create_node" as const, node: { id: "pedro", type: "Person" as const, name: "Pedro" }, reason: "Interview" },
			{ type: "create_node" as const, node: { id: "guess", type: "Person" as const, name: "AI guess" }, reason: "AI guess" },
		];
		await writer.applyProposalsWithDecisions(proposals, [
			// Reviewer clients may return decisions in any order.
			{ proposalIndex: 1, decision: "reject" },
			{ proposalIndex: 0, decision: "approve" },
		]);

		expect((await graph.listNodes()).map((node) => node.id)).toEqual(["pedro"]);
		expect((await ledger.listByOrganization("org-1")).some((item) => item.subjectEntityId === "guess")).toBe(false);
	});
});
