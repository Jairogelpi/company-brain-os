import { describe, expect, it } from "vitest";
import { createInMemoryAssertionRepository } from "@/db/assertion-repository";
import { createInMemoryGraphRepository } from "@/db/repository";
import { rebuildApprovedAssertionProjection } from "./assertion-projection-service";
import { ENTITY_PREDICATES } from "./graph-projection";
import type { Assertion } from "./assertions";

function scalar(id: string, subjectEntityId: string, predicate: string, scalarValue: string | number | boolean): Assertion {
	return {
		id, organizationId: "org-1", subjectEntityId, predicate, scalarValue,
		sourceType: "manual", sourceId: "canonical-test", status: "approved",
		proposedBy: "owner", approvedBy: "validator", recordedAt: "2026-07-31T00:00:00.000Z",
		confidenceClass: "verified", metadata: {},
	};
}

describe("assertion projection service", () => {
	it("replaces the entire graph and preserves assertion provenance", async () => {
		const assertions = createInMemoryAssertionRepository();
		const graph = createInMemoryGraphRepository();
		await graph.createNode({ id: "manual", type: "Person", name: "Untraceable", companyId: "org-1" });
		await assertions.create(scalar("pedro-type", "pedro", ENTITY_PREDICATES.type, "Person"));
		await assertions.create(scalar("pedro-name", "pedro", ENTITY_PREDICATES.name, "Pedro"));
		await assertions.create(scalar("unit-type", "ops", ENTITY_PREDICATES.type, "OrganizationalUnit"));
		await assertions.create(scalar("unit-name", "ops", ENTITY_PREDICATES.name, "Operations"));
		await assertions.create({
			...scalar("belongs", "pedro", "BELONGS_TO", true),
			scalarValue: undefined,
			objectEntityId: "ops",
		});
		await assertions.create({
			...scalar("rejected", "pedro", "MANAGES", true),
			scalarValue: undefined,
			objectEntityId: "ops",
			status: "rejected",
			approvedBy: undefined,
		});

		const projection = await rebuildApprovedAssertionProjection(assertions, graph, "org-1");

		expect(projection.nodes).toHaveLength(2);
		expect(await graph.readNode("manual")).toBeUndefined();
		expect(await graph.listEdges()).toEqual([
			expect.objectContaining({
				id: "assertion:belongs",
				type: "BELONGS_TO",
				attributes: expect.objectContaining({ assertionId: "belongs" }),
			}),
		]);
	});

	it("removes every stale projection row when the ledger has no active truth", async () => {
		const assertions = createInMemoryAssertionRepository();
		const graph = createInMemoryGraphRepository();
		await graph.createNode({ id: "stale-person", type: "Person", name: "Stale", companyId: "org-1" });
		await graph.createNode({ id: "stale-unit", type: "OrganizationalUnit", name: "Stale unit", companyId: "org-1" });
		await graph.createEdge({ id: "stale-edge", type: "BELONGS_TO", fromNodeId: "stale-person", toNodeId: "stale-unit", companyId: "org-1" });

		await rebuildApprovedAssertionProjection(assertions, graph, "org-1");

		expect(await graph.listNodes()).toEqual([]);
		expect(await graph.listEdges()).toEqual([]);
	});
});
