import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { generatePlaybook } from "./succession";
import type { GraphNode, GraphEdge, KnowledgeNode } from "./graph";

const pedro: GraphNode = { id: "person-pedro", type: "Person", name: "Pedro" };

function knowledge(
	id: string,
	name: string,
	criticality: "low" | "medium" | "high",
	documented = false,
): KnowledgeNode {
	return {
		id,
		type: "Knowledge",
		name,
		criticality,
		documented,
		knowledgeType: "technical",
		validationState: "proposed",
		confidence: 30,
	};
}

function masters(person: string, k: string, level = 5): GraphEdge {
	return {
		id: `e-${person}-${k}`,
		type: "MASTERS",
		fromNodeId: person,
		toNodeId: k,
		attributes: { level },
	};
}

describe("succession — generatePlaybook", () => {
	it("Scenario: covers sole-expert knowledge, critical first", () => {
		const k1 = knowledge("k-crit", "configurar llenadora", "high");
		const k2 = knowledge("k-low", "archivar albaranes", "low");
		const graph = {
			nodes: [pedro, k1, k2],
			edges: [masters("person-pedro", "k-crit"), masters("person-pedro", "k-low")],
		};

		const pb = generatePlaybook("person-pedro", graph);

		expect(pb.personName).toBe("Pedro");
		expect(pb.actions.map((a) => a.knowledgeId)).toEqual(["k-crit", "k-low"]);
		expect(pb.actions[0].criticality).toBe("high");
	});

	it("Scenario: equal criticality ordered by exposure when provided", () => {
		const a = knowledge("k-a", "A", "high");
		const b = knowledge("k-b", "B", "high");
		const graph = {
			nodes: [pedro, a, b],
			edges: [masters("person-pedro", "k-a"), masters("person-pedro", "k-b")],
		};

		const pb = generatePlaybook("person-pedro", graph, {
			exposure: { "k-a": 5000, "k-b": 20000 },
		});
		expect(pb.actions[0].knowledgeId).toBe("k-b"); // higher exposure first
	});

	it("falls back to bus factor when no exposure is given", () => {
		const a = knowledge("k-a", "A", "high"); // Pedro sole expert → busFactor 1
		const b = knowledge("k-b", "B", "high"); // also has María → busFactor 2
		const maria: GraphNode = { id: "person-maria", type: "Person", name: "María" };
		const graph = {
			nodes: [pedro, maria, a, b],
			edges: [
				masters("person-pedro", "k-a"),
				masters("person-pedro", "k-b"),
				masters("person-maria", "k-b"),
			],
		};
		const pb = generatePlaybook("person-pedro", graph);
		// k-a (busFactor 1, no backup) is more urgent than k-b (busFactor 2)
		expect(pb.actions[0].knowledgeId).toBe("k-a");
	});

	it("Scenario: schedules target dates backward from the last day", () => {
		const graph = {
			nodes: [
				pedro,
				knowledge("k1", "K1", "high"),
				knowledge("k2", "K2", "medium"),
				knowledge("k3", "K3", "low"),
			],
			edges: [
				masters("person-pedro", "k1"),
				masters("person-pedro", "k2"),
				masters("person-pedro", "k3"),
			],
		};
		const lastDay = new Date(Date.now() + 30 * 86400000)
			.toISOString()
			.slice(0, 10);

		const pb = generatePlaybook("person-pedro", graph, { lastDay });

		expect(pb.actions).toHaveLength(3);
		for (const a of pb.actions) {
			expect(a.targetDate).toBeDefined();
			expect(a.targetDate! <= lastDay).toBe(true);
		}
		// higher-priority action scheduled earlier
		expect(pb.actions[0].targetDate! < pb.actions[2].targetDate!).toBe(true);
	});

	it("undocumented vs documented action wording", () => {
		const graph = {
			nodes: [pedro, knowledge("k1", "K1", "high", false)],
			edges: [masters("person-pedro", "k1")],
		};
		const pb = generatePlaybook("person-pedro", graph);
		expect(pb.actions[0].action.toLowerCase()).toContain("document");
	});

	it("person with no mastered knowledge yields an empty playbook", () => {
		const pb = generatePlaybook("person-pedro", { nodes: [pedro], edges: [] });
		expect(pb.actions).toHaveLength(0);
	});

	it("keeps the deterministic domain layer free of AI imports", () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const source = readFileSync(join(dir, "succession.ts"), "utf8");

		expect(source).not.toContain('from "@/ai/');
		expect(source).not.toContain('from "./ai/');
	});
});
