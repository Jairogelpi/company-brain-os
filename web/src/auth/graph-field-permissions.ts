const VALIDATOR_FIELDS = new Set([
	"criticality",
	"knowledgeType",
	"documented",
	"validationState",
	"confidence",
]);

/** Risk/control facts can only be changed by a validator-capable principal. */
export function patchRequiresValidation(patch: Record<string, unknown>): boolean {
	return Object.keys(patch).some((key) => VALIDATOR_FIELDS.has(key));
}
