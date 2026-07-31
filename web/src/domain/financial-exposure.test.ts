import { describe, expect, it } from "vitest";
import {
	computeRiskExposure,
	computeTotalExposure,
	DEFAULT_RECOVERY_DAYS,
} from "./financial-exposure";
import type { GraphNode } from "./graph";
import type { DetectedRisk } from "./risk-engine";

function process(id: string, attrs: Record<string, unknown> = {}): GraphNode {
	return {
		id,
		type: "Process",
		name: id,
		criticality: "high",
		attributes: attrs,
	};
}
function person(id: string, attrs: Record<string, unknown> = {}): GraphNode {
	return { id, type: "Person", name: id, attributes: attrs };
}
function risk(
	sourceNodeId: string,
	relatedNodeIds: string[] = [],
): DetectedRisk {
	return {
		id: `risk-${sourceNodeId}`,
		riskType: "single_point_of_failure",
		severity: "critical",
		sourceNodeId,
		sourceNodeName: sourceNodeId,
		relatedNodeIds,
		message: "",
		confidence: 20,
		trigger: "",
		ruleId: "test",
		ruleVersion: 1,
		inputFacts: {},
		evidenceRefs: [],
	};
}

describe("financial-exposure", () => {
	it("Scenario: single point of failure gets a euro figure", () => {
		const nodes = [
			process("proc-x", { downtimeCostPerDay: 6000, recoveryDays: 3 }),
			person("pedro", { replacementCost: 0 }),
		];
		const r = computeRiskExposure(risk("proc-x", ["pedro"]), nodes);
		expect(r.exposure).toBe(18000); // 6000 × 3 + 0
		expect(r.currency).toBe("EUR");
		expect(r.estimated).toBe(false);
	});

	it("adds replacement cost of the related person", () => {
		const nodes = [
			process("proc-x", { downtimeCostPerDay: 1000, recoveryDays: 2 }),
			person("pedro", { replacementCost: 5000 }),
		];
		const r = computeRiskExposure(risk("proc-x", ["pedro"]), nodes);
		expect(r.exposure).toBe(7000); // 2000 + 5000
	});

	it("Scenario: missing cost values fall back to defaults and flag estimated", () => {
		const nodes = [process("proc-x"), person("pedro")];
		const r = computeRiskExposure(risk("proc-x", ["pedro"]), nodes);
		expect(r.estimated).toBe(true);
		expect(r.recoveryDays).toBe(DEFAULT_RECOVERY_DAYS);
		expect(r.exposure).toBeGreaterThan(0);
	});

	it("Scenario: aggregate de-duplicates the same at-risk node", () => {
		const nodes = [
			process("proc-x", { downtimeCostPerDay: 1000, recoveryDays: 1 }),
			process("proc-y", { downtimeCostPerDay: 2000, recoveryDays: 1 }),
		];
		// two risks on proc-x (must count once) + one on proc-y
		const risks = [risk("proc-x"), risk("proc-x"), risk("proc-y")];
		const total = computeTotalExposure(risks, nodes);
		expect(total.total).toBe(3000); // 1000 (proc-x once) + 2000 (proc-y)
		expect(total.currency).toBe("EUR");
	});

	it("treats negative cost attributes as missing estimates", () => {
		const nodes = [
			process("proc-x", { downtimeCostPerDay: -500, recoveryDays: 5 }),
			person("pedro", { replacementCost: -1000 }),
		];

		const r = computeRiskExposure(risk("proc-x", ["pedro"]), nodes);

		expect(r.exposure).toBeGreaterThanOrEqual(0);
		expect(r.estimated).toBe(true);
	});

	it("keeps valid non-negative cost attributes as non-estimated", () => {
		const nodes = [
			process("proc-x", { downtimeCostPerDay: 500, recoveryDays: 2 }),
			person("pedro", { replacementCost: 0 }),
		];

		const r = computeRiskExposure(risk("proc-x", ["pedro"]), nodes);

		expect(r.exposure).toBe(1000);
		expect(r.estimated).toBe(false);
	});
});
