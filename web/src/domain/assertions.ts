export const ASSERTION_STATUSES = [
	"draft",
	"proposed",
	"approved",
	"disputed",
	"rejected",
	"superseded",
	"expired",
	"archived",
] as const;

export type AssertionStatus = (typeof ASSERTION_STATUSES)[number];

export const CONFIDENCE_CLASSES = [
	"unverified",
	"weak",
	"supported",
	"verified",
	"contested",
] as const;

export type ConfidenceClass = (typeof CONFIDENCE_CLASSES)[number];

export type Assertion = {
	id: string;
	organizationId: string;
	subjectEntityId: string;
	predicate: string;
	objectEntityId?: string;
	scalarValue?: string | number | boolean | null;
	sourceType: string;
	sourceId: string;
	status: AssertionStatus;
	proposedBy: string;
	approvedBy?: string;
	validFrom?: string;
	validUntil?: string;
	recordedAt: string;
	supersededBy?: string;
	confidenceClass: ConfidenceClass;
	reviewDueAt?: string;
	metadata: Record<string, unknown>;
};

export type AssertionValidationIssue = {
	code:
		| "missing_organization"
		| "missing_subject"
		| "missing_predicate"
		| "missing_object"
		| "missing_provenance"
		| "missing_proposer"
		| "missing_recorded_at";
};

export function validateAssertion(
	assertion: Partial<Assertion>,
): AssertionValidationIssue[] {
	const issues: AssertionValidationIssue[] = [];
	if (!assertion.organizationId) issues.push({ code: "missing_organization" });
	if (!assertion.subjectEntityId) issues.push({ code: "missing_subject" });
	if (!assertion.predicate) issues.push({ code: "missing_predicate" });
	if (!assertion.objectEntityId && assertion.scalarValue === undefined) {
		issues.push({ code: "missing_object" });
	}
	if (!assertion.sourceType || !assertion.sourceId) {
		issues.push({ code: "missing_provenance" });
	}
	if (!assertion.proposedBy) issues.push({ code: "missing_proposer" });
	if (!assertion.recordedAt) issues.push({ code: "missing_recorded_at" });
	return issues;
}

const transitions: Record<AssertionStatus, readonly AssertionStatus[]> = {
	draft: ["proposed", "archived"],
	proposed: ["approved", "disputed", "rejected", "archived"],
	approved: ["disputed", "superseded", "expired", "archived"],
	disputed: ["approved", "rejected", "superseded", "archived"],
	rejected: ["archived"],
	superseded: ["archived"],
	expired: ["superseded", "archived"],
	archived: [],
};

export function assertionCanTransition(
	from: AssertionStatus,
	to: AssertionStatus,
): boolean {
	return transitions[from].includes(to);
}
