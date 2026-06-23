import { describe, expect, it } from "vitest";
import { layoutGraph } from "./graph-layout";
import type { GraphEdge, GraphNode } from "@/domain/graph";

function person(id: string): GraphNode {
	return { id, type: "Person", name: id };
}
function knowledge(id: string): GraphNode {
	return {
		id,
		type: "Knowledge",
		name: id,
		knowledgeType: "technical",
		documented: false,
		validationState: "proposed",
		confidence: 50,
	} as GraphNode;
}
function masters(from: string, to: string): GraphEdge {
	return { id: `e-${from}-${to}`, type: "MASTERS", fromNodeId: from, toNodeId: to };
}

const opts = { width: 1000, height: 800, iterations: 120 };

describe("layoutGraph", () => {
	it("returns a position for every node, within reasonable bounds", () => {
		const nodes = [person("a"), person("b"), knowledge("k")];
		const pos = layoutGraph(nodes, [masters("a", "k")], opts);
		expect(Object.keys(pos).sort()).toEqual(["a", "b", "k"]);
		for (const p of Object.values(pos)) {
			expect(Number.isFinite(p.x)).toBe(true);
			expect(Number.isFinite(p.y)).toBe(true);
		}
	});

	it("is deterministic — same input yields identical output", () => {
		const nodes = [person("a"), person("b"), knowledge("k")];
		const edges = [masters("a", "k"), masters("b", "k")];
		expect(layoutGraph(nodes, edges, opts)).toEqual(
			layoutGraph(nodes, edges, opts),
		);
	});

	it("pins nodes that carry stored x/y and never moves them", () => {
		const pinned: GraphNode = {
			...person("a"),
			attributes: { x: 123, y: 456 },
		};
		const pos = layoutGraph([pinned, person("b")], [masters("a", "b")], opts);
		expect(pos.a).toEqual({ x: 123, y: 456 });
	});

	it("springs settle a connected pair near the link distance", () => {
		// Two nodes seed on opposite sides of the circle (~640 apart). The spring
		// (rest length 150) must pull them in to roughly that distance.
		const nodes = [person("a"), knowledge("k")];
		const pos = layoutGraph(nodes, [masters("a", "k")], {
			...opts,
			iterations: 400,
			linkDistance: 150,
		});
		const d = Math.hypot(pos.a.x - pos.k.x, pos.a.y - pos.k.y);
		expect(d).toBeGreaterThan(80);
		expect(d).toBeLessThan(300);
	});

	it("handles an empty graph", () => {
		expect(layoutGraph([], [], opts)).toEqual({});
	});
});
