import { describe, expect, it } from "vitest";
import { explainRiskRule } from "./risk-rules";

describe("continuity risk rules", () => {
	it("returns a versioned, explainable single-point-of-failure rule", () => {
		expect(explainRiskRule("single_point_of_failure")).toEqual({
			id: "knowledge-single-point-of-failure",
			version: 1,
			condition: "bus_factor=1 AND criticality=high AND documented=false",
			requiredEvidence: ["mastery_assertion", "criticality_assertion"],
		});
	});

	it("returns no rule for an unknown detector", () => {
		expect(explainRiskRule("unknown")).toBeUndefined();
	});
});
