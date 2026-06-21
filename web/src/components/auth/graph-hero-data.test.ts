import { describe, expect, it } from "vitest";
import {
	HERO_NODES,
	HERO_EDGES,
	buildRevealSteps,
	CRITICAL_NODE_INDEX,
} from "./graph-hero-data";

describe("GraphHero reveal steps", () => {
	it("provides a single static step under prefers-reduced-motion", () => {
		const steps = buildRevealSteps(true);

		expect(steps).toHaveLength(1);
		expect(steps[0].visibleNodes).toHaveLength(HERO_NODES.length);
		expect(steps[0].drawnEdges).toHaveLength(HERO_EDGES.length);
		expect(steps[0].pulse).toBe(true);
	});

	it("stagger-builds the graph and arms the pulse last when motion is allowed", () => {
		const steps = buildRevealSteps(false);

		expect(steps.length).toBeGreaterThan(1);
		// First step reveals only the first node and no edges yet.
		expect(steps[0].visibleNodes).toEqual([0]);
		expect(steps[0].drawnEdges).toEqual([]);
		expect(steps[0].pulse).toBe(false);

		// Final step reveals everything and arms the critical-node pulse.
		const last = steps[steps.length - 1];
		expect(last.visibleNodes).toHaveLength(HERO_NODES.length);
		expect(last.drawnEdges).toHaveLength(HERO_EDGES.length);
		expect(last.pulse).toBe(true);
	});

	it("marks exactly one critical node (the yellow accent)", () => {
		const critical = HERO_NODES.filter((n) => n.critical);
		expect(critical).toHaveLength(1);
		expect(CRITICAL_NODE_INDEX).toBeGreaterThanOrEqual(0);
	});

	it("every edge references nodes that exist", () => {
		const ids = new Set(HERO_NODES.map((n) => n.id));
		for (const edge of HERO_EDGES) {
			expect(ids.has(edge.from)).toBe(true);
			expect(ids.has(edge.to)).toBe(true);
		}
	});
});
