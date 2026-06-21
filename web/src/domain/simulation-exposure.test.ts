import { describe, expect, it } from "vitest";
import { simulatePersonLeaving } from "./simulator";
import { simulationExposure } from "./simulation-exposure";
import type { GraphNode, GraphEdge, KnowledgeNode } from "./graph";

const pedro: GraphNode = { id: "person-pedro", type: "Person", name: "Pedro" };
const maria: GraphNode = { id: "person-maria", type: "Person", name: "María" };

function crit(id: string): KnowledgeNode {
	return {
		id,
		type: "Knowledge",
		name: id,
		criticality: "high",
		documented: false,
		knowledgeType: "technical",
		validationState: "proposed",
		confidence: 25,
	};
}
function masters(p: string, k: string, level = 5): GraphEdge {
	return { id: `e-${p}-${k}`, type: "MASTERS", fromNodeId: p, toNodeId: k, attributes: { level } };
}

describe("simulation-exposure", () => {
	it("Scenario: simulation shows total euro impact for newly-at-risk knowledge", () => {
		const nodes = [pedro, crit("k1")];
		const edges = [masters("person-pedro", "k1")];
		const report = simulatePersonLeaving(nodes, edges, "person-pedro");

		const exp = simulationExposure(report, nodes);
		expect(exp.newRiskCount).toBeGreaterThanOrEqual(1);
		expect(exp.total).toBeGreaterThan(0);
		expect(exp.currency).toBe("EUR");
	});

	it("departure that introduces no new risk → zero euro impact", () => {
		// Non-critical knowledge with a backup: losing one expert raises no new risk.
		const lowK: KnowledgeNode = {
			id: "k-low",
			type: "Knowledge",
			name: "archivar albaranes",
			criticality: "low",
			documented: true,
			knowledgeType: "process",
			validationState: "validated",
			confidence: 80,
		};
		const nodes = [pedro, maria, lowK];
		const edges = [
			masters("person-pedro", "k-low"),
			masters("person-maria", "k-low"),
		];
		const report = simulatePersonLeaving(nodes, edges, "person-pedro");
		const exp = simulationExposure(report, nodes);
		expect(exp.total).toBe(0);
		expect(exp.newRiskCount).toBe(0);
	});
});
