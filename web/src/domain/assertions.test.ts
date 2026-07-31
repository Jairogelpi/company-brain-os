import { describe, expect, it } from "vitest";
import {
	assertionCanTransition,
	validateAssertion,
	type Assertion,
} from "./assertions";

const proposedAssertion: Assertion = {
	id: "assertion-1",
	organizationId: "org-acme",
	subjectEntityId: "person-pedro",
	predicate: "MASTERS",
	objectEntityId: "knowledge-line-config",
	sourceType: "interview_answer",
	sourceId: "answer-1",
	status: "proposed",
	proposedBy: "user-owner",
	recordedAt: "2026-07-31T00:00:00.000Z",
	confidenceClass: "supported",
	metadata: {},
};

describe("assertion ledger contract", () => {
	it("accepts a proposed assertion with tenant and provenance", () => {
		expect(validateAssertion(proposedAssertion)).toEqual([]);
	});

	it("rejects an assertion without provenance", () => {
		const { sourceId: _sourceId, ...withoutSource } = proposedAssertion;

		expect(validateAssertion(withoutSource)).toContainEqual({
			code: "missing_provenance",
		});
	});

	it.each([
		["organizationId", "missing_organization"],
		["subjectEntityId", "missing_subject"],
		["predicate", "missing_predicate"],
		["proposedBy", "missing_proposer"],
		["recordedAt", "missing_recorded_at"],
	] as const)("requires %s", (field, code) => {
		const invalid = { ...proposedAssertion, [field]: "" };

		expect(validateAssertion(invalid)).toContainEqual({ code });
	});

	it("accepts a scalar assertion without an object entity", () => {
		const { objectEntityId: _objectEntityId, ...scalarAssertion } = proposedAssertion;

		expect(validateAssertion({ ...scalarAssertion, scalarValue: 3 })).toEqual([]);
	});

	it("requires an entity or scalar object", () => {
		const { objectEntityId: _objectEntityId, ...withoutObject } = proposedAssertion;

		expect(validateAssertion(withoutObject)).toContainEqual({
			code: "missing_object",
		});
	});

	it("does not allow approved truth to return to draft", () => {
		expect(assertionCanTransition("approved", "draft")).toBe(false);
		expect(assertionCanTransition("approved", "superseded")).toBe(true);
	});
});
