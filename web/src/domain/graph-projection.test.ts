import { describe, expect, it } from "vitest";
import { ENTITY_PREDICATES, projectApprovedAssertions } from "./graph-projection";
import type { Assertion } from "./assertions";

const recordedAt = "2026-07-31T00:00:00.000Z";
const at = new Date("2026-08-01T00:00:00.000Z").getTime();

function scalar(
	id: string,
	subjectEntityId: string,
	predicate: string,
	scalarValue: string | number | boolean,
): Assertion {
	return {
		id,
		organizationId: "org-1",
		subjectEntityId,
		predicate,
		scalarValue,
		sourceType: "interview",
		sourceId: "answer-1",
		status: "approved",
		proposedBy: "owner",
		approvedBy: "validator",
		recordedAt,
		confidenceClass: "verified",
		metadata: {},
	};
}

const entityAssertions: Assertion[] = [
	scalar("pedro-type", "pedro", ENTITY_PREDICATES.type, "Person"),
	scalar("pedro-name", "pedro", ENTITY_PREDICATES.name, "Pedro"),
	scalar("knowledge-type", "line-config", ENTITY_PREDICATES.type, "Knowledge"),
	scalar("knowledge-name", "line-config", ENTITY_PREDICATES.name, "Line configuration"),
	scalar("knowledge-kind", "line-config", ENTITY_PREDICATES.knowledgeType, "technical"),
	scalar("knowledge-documented", "line-config", ENTITY_PREDICATES.documented, false),
	scalar("knowledge-state", "line-config", ENTITY_PREDICATES.validationState, "validated"),
	scalar("knowledge-confidence", "line-config", ENTITY_PREDICATES.confidence, 90),
];

describe("approved assertion graph projection", () => {
	it("deterministically projects complete entities and approved relationships", () => {
		const relationship: Assertion = {
			...scalar("a-1", "pedro", "MASTERS", true),
			scalarValue: undefined,
			objectEntityId: "line-config",
			metadata: { edgeAttributes: { level: 5 } },
		};
		const proposed: Assertion = {
			...relationship,
			id: "a-2",
			predicate: "LEARNS",
			status: "proposed",
			approvedBy: undefined,
		};
		const projection = projectApprovedAssertions([...entityAssertions, relationship, proposed], at);

		expect(projection.nodes).toHaveLength(2);
		expect(projection.nodes.find((node) => node.id === "pedro")?.attributes).toEqual(
			expect.objectContaining({ provenance: expect.objectContaining({ assertionIds: ["pedro-name", "pedro-type"] }) }),
		);
		expect(projection.edges).toEqual([
			{
				id: "assertion:a-1",
				type: "MASTERS",
				fromNodeId: "pedro",
				toNodeId: "line-config",
				attributes: { level: 5, assertionId: "a-1", assertionIds: ["a-1"], evidenceClass: "verified" },
			},
		]);
		expect(projection.hash).toBe(projectApprovedAssertions([...projection.assertions], at).hash);
	});

	it("never projects rejected, expired, dangling, or invalid endpoint assertions", () => {
		const relationship = (id: string, status: Assertion["status"], predicate = "MASTERS"): Assertion => ({
			...scalar(id, "pedro", predicate, true),
			scalarValue: undefined,
			objectEntityId: "line-config",
			status,
			approvedBy: status === "approved" ? "validator" : undefined,
		});
		const projection = projectApprovedAssertions([
			...entityAssertions,
			relationship("rejected", "rejected"),
			{ ...relationship("expired", "approved"), validUntil: "2026-07-31T12:00:00.000Z" },
			{ ...relationship("dangling", "approved"), objectEntityId: "missing" },
			relationship("bad-endpoint", "approved", "DOCUMENTS"),
		], at);

		expect(projection.edges).toEqual([]);
		expect(projection.rejectedInputs).toEqual(expect.arrayContaining([
			{ assertionId: "dangling", reason: "missing_entity" },
			{ assertionId: "bad-endpoint", reason: "invalid_endpoint" },
		]));
	});

	it("uses the latest approved scalar without mutating history", () => {
		const projection = projectApprovedAssertions([
			...entityAssertions,
			scalar("old-name", "pedro", ENTITY_PREDICATES.name, "Pedro old"),
			{ ...scalar("new-name", "pedro", ENTITY_PREDICATES.name, "Pedro Gelpi"), recordedAt: "2026-07-31T01:00:00.000Z" },
		], at);

		expect(projection.nodes.find((node) => node.id === "pedro")?.name).toBe("Pedro Gelpi");
	});

	it("rejects incomplete entities and malformed knowledge instead of inventing defaults", () => {
		const projection = projectApprovedAssertions([
			scalar("bad-type", "bad-type-entity", ENTITY_PREDICATES.type, "Risk"),
			scalar("bad-type-name", "bad-type-entity", ENTITY_PREDICATES.name, "Not canonical"),
			scalar("empty-name-type", "empty-name-entity", ENTITY_PREDICATES.type, "Person"),
			scalar("empty-name", "empty-name-entity", ENTITY_PREDICATES.name, ""),
			scalar("bad-k-type", "bad-knowledge", ENTITY_PREDICATES.type, "Knowledge"),
			scalar("bad-k-name", "bad-knowledge", ENTITY_PREDICATES.name, "Incomplete knowledge"),
			scalar("bad-k-kind", "bad-knowledge", ENTITY_PREDICATES.knowledgeType, "made-up"),
		], at);

		expect(projection.nodes).toEqual([]);
		expect(projection.rejectedInputs).toEqual(expect.arrayContaining([
			{ assertionId: "bad-type", reason: "invalid_scalar" },
			{ assertionId: "empty-name", reason: "invalid_scalar" },
			{ assertionId: "bad-k-kind", reason: "invalid_scalar" },
		]));
	});
});
