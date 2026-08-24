export type ContinuityRiskType =
	| "single_point_of_failure"
	| "bus_factor_zero"
	| "undocumented_critical"
	| "low_resilience"
	| "single_point_of_contact";

export type RiskRule = {
	id: string;
	version: number;
	condition: string;
	requiredEvidence: string[];
};

const rules: Record<ContinuityRiskType, RiskRule> = {
	single_point_of_failure: {
		id: "knowledge-single-point-of-failure", version: 2,
		condition: "bus_factor=1 AND criticality=high",
		requiredEvidence: ["mastery_assertion", "criticality_assertion"],
	},
	bus_factor_zero: { id: "knowledge-lost", version: 1, condition: "bus_factor=0 AND criticality=high", requiredEvidence: ["criticality_assertion"] },
	undocumented_critical: { id: "critical-knowledge-undocumented", version: 1, condition: "documented=false AND criticality=high", requiredEvidence: ["criticality_assertion"] },
	low_resilience: { id: "process-weak-link", version: 1, condition: "process_resilience<=1", requiredEvidence: ["requires_assertion"] },
	single_point_of_contact: { id: "external-party-single-contact", version: 1, condition: "owner_count=1", requiredEvidence: ["ownership_assertion"] },
};

export function explainRiskRule(type: string): RiskRule | undefined {
	return rules[type as ContinuityRiskType];
}
