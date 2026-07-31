import { describe, expect, it } from "vitest";
import { projectApprovedAssertions } from "./graph-projection";
import type { Assertion } from "./assertions";

const base: Omit<Assertion, "id" | "status" | "predicate" | "objectEntityId"> = {
	organizationId: "org-1", subjectEntityId: "pedro", sourceType: "interview", sourceId: "answer-1",
	proposedBy: "owner", recordedAt: "2026-07-31T00:00:00.000Z", confidenceClass: "supported", metadata: {},
};

describe("approved assertion graph projection", () => {
	it("projects approved relationship assertions only", () => {
		const projection = projectApprovedAssertions([
			{ ...base, id: "a-1", status: "approved", predicate: "MASTERS", objectEntityId: "line-config" },
			{ ...base, id: "a-2", status: "proposed", predicate: "LEARNS", objectEntityId: "line-config" },
		]);

		expect(projection.edges).toEqual([
			{ id: "assertion:a-1", type: "MASTERS", fromNodeId: "pedro", toNodeId: "line-config", attributes: { assertionId: "a-1", evidenceClass: "supported" } },
		]);
		expect(projection.hash).toBe(projectApprovedAssertions([...projection.assertions]).hash);
	});

	it("does not project scalar or unknown predicates as graph edges", () => {
		const projection = projectApprovedAssertions([
			{ ...base, id: "a-1", status: "approved", predicate: "CRITICALITY", scalarValue: "high" },
			{ ...base, id: "a-2", status: "approved", predicate: "UNKNOWN", objectEntityId: "line-config" },
		]);

		expect(projection.edges).toEqual([]);
	});
});
