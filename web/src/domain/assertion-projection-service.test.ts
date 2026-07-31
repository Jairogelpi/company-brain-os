import { describe, expect, it } from "vitest";
import { createInMemoryAssertionRepository } from "@/db/assertion-repository";
import { createInMemoryGraphRepository } from "@/db/repository";
import { rebuildApprovedAssertionProjection } from "./assertion-projection-service";
import type { Assertion } from "./assertions";

const base: Omit<Assertion, "id" | "status" | "predicate" | "objectEntityId"> = {
	organizationId: "org-1",
	subjectEntityId: "pedro",
	sourceType: "interview",
	sourceId: "answer-1",
	proposedBy: "owner",
	recordedAt: "2026-07-31T00:00:00.000Z",
	confidenceClass: "supported",
	metadata: {},
};

describe("assertion projection service", () => {
	it("rebuilds only approved relationships and preserves provenance", async () => {
		const assertions = createInMemoryAssertionRepository();
		const graph = createInMemoryGraphRepository();
		await graph.createNode({ id: "pedro", type: "Person", name: "Pedro", companyId: "org-1" });
		await graph.createNode({ id: "line-config", type: "Knowledge", name: "Line config", companyId: "org-1" });
		await graph.createEdge({ id: "manual-edge", type: "DOCUMENTS", fromNodeId: "pedro", toNodeId: "line-config", companyId: "org-1" });
		await assertions.create({ ...base, id: "approved", status: "approved", predicate: "MASTERS", objectEntityId: "line-config" });
		await assertions.create({ ...base, id: "rejected", status: "rejected", predicate: "LEARNS", objectEntityId: "line-config" });

		const projection = await rebuildApprovedAssertionProjection(assertions, graph, "org-1");

		expect(projection.edges).toHaveLength(1);
		expect(await graph.listEdges()).toEqual(expect.arrayContaining([
			expect.objectContaining({ id: "manual-edge" }),
			expect.objectContaining({
				id: "assertion:approved",
				type: "MASTERS",
				attributes: expect.objectContaining({ assertionId: "approved" }),
			}),
		]));
	});

	it("removes stale projected edges when an assertion is no longer approved", async () => {
		const assertions = createInMemoryAssertionRepository();
		const graph = createInMemoryGraphRepository();
		await graph.createNode({ id: "pedro", type: "Person", name: "Pedro", companyId: "org-1" });
		await graph.createNode({ id: "line-config", type: "Knowledge", name: "Line config", companyId: "org-1" });
		await graph.createEdge({ id: "assertion:old", type: "MASTERS", fromNodeId: "pedro", toNodeId: "line-config", companyId: "org-1", attributes: { assertionId: "old" } });

		await rebuildApprovedAssertionProjection(assertions, graph, "org-1");

		expect(await graph.readEdge("assertion:old")).toBeUndefined();
	});
});
