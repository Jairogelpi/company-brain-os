import type { GraphEdge, GraphNode } from "@/domain/graph";

/**
 * Deterministic force-directed layout for the interactive graph.
 *
 * Pure and seedless: the initial placement is a stable circle by index (no
 * RNG), so the same input always yields the same output — important for tests
 * and for a layout that doesn't jump around between renders. Nodes that already
 * carry `attributes.x/attributes.y` (persisted positions) are pinned and never
 * moved, so a user's manual arrangement is respected.
 */

export type Point = { x: number; y: number };
export type LayoutPositions = Record<string, Point>;

export type LayoutOptions = {
	width?: number;
	height?: number;
	iterations?: number;
	/** Ideal edge length (spring rest length). */
	linkDistance?: number;
	/** Repulsion strength between every pair of nodes. */
	charge?: number;
};

const DEFAULTS = {
	width: 1200,
	height: 800,
	iterations: 300,
	linkDistance: 180,
	charge: 12000,
};

function storedPoint(node: GraphNode): Point | null {
	const x = node.attributes?.x;
	const y = node.attributes?.y;
	if (typeof x === "number" && typeof y === "number") return { x, y };
	return null;
}

/**
 * Computes 2D positions for every node. Returns a plain map id → {x,y}.
 * Pinned nodes (with stored positions) keep their coordinates exactly.
 */
export function layoutGraph(
	nodes: GraphNode[],
	edges: GraphEdge[],
	options: LayoutOptions = {},
): LayoutPositions {
	const width = options.width ?? DEFAULTS.width;
	const height = options.height ?? DEFAULTS.height;
	const iterations = options.iterations ?? DEFAULTS.iterations;
	const linkDistance = options.linkDistance ?? DEFAULTS.linkDistance;
	const charge = options.charge ?? DEFAULTS.charge;

	const cx = width / 2;
	const cy = height / 2;
	const n = nodes.length;
	if (n === 0) return {};

	const pos: Point[] = [];
	const pinned: boolean[] = [];
	const radius = Math.min(width, height) / 2 - 80;

	nodes.forEach((node, i) => {
		const stored = storedPoint(node);
		if (stored) {
			pos.push({ ...stored });
			pinned.push(true);
		} else {
			// Stable seed: evenly spaced on a circle by index.
			const angle = (2 * Math.PI * i) / n;
			pos.push({
				x: cx + radius * Math.cos(angle),
				y: cy + radius * Math.sin(angle),
			});
			pinned.push(false);
		}
	});

	const index = new Map(nodes.map((node, i) => [node.id, i]));
	const links = edges
		.map((e) => ({
			a: index.get(e.fromNodeId),
			b: index.get(e.toNodeId),
		}))
		.filter((l): l is { a: number; b: number } => l.a != null && l.b != null);

	for (let step = 0; step < iterations; step++) {
		const disp: Point[] = pos.map(() => ({ x: 0, y: 0 }));

		// Repulsion (Coulomb-like) between every pair.
		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				let dx = pos[i].x - pos[j].x;
				let dy = pos[i].y - pos[j].y;
				let distSq = dx * dx + dy * dy;
				if (distSq < 0.01) {
					// Coincident: nudge deterministically by index.
					dx = (i - j) * 0.5 + 0.1;
					dy = (j - i) * 0.5 + 0.1;
					distSq = dx * dx + dy * dy;
				}
				const force = charge / distSq;
				const dist = Math.sqrt(distSq);
				const fx = (dx / dist) * force;
				const fy = (dy / dist) * force;
				disp[i].x += fx;
				disp[i].y += fy;
				disp[j].x -= fx;
				disp[j].y -= fy;
			}
		}

		// Attraction (Hooke-like) along edges.
		for (const { a, b } of links) {
			const dx = pos[a].x - pos[b].x;
			const dy = pos[a].y - pos[b].y;
			const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
			const force = (dist - linkDistance) * 0.05;
			const fx = (dx / dist) * force;
			const fy = (dy / dist) * force;
			disp[a].x -= fx;
			disp[a].y -= fy;
			disp[b].x += fx;
			disp[b].y += fy;
		}

		// Cooling: limit per-step movement, decreasing over time.
		const maxStep = 30 * (1 - step / iterations) + 1;
		for (let i = 0; i < n; i++) {
			if (pinned[i]) continue;
			// Gentle gravity toward centre keeps disconnected nodes from drifting.
			disp[i].x += (cx - pos[i].x) * 0.01;
			disp[i].y += (cy - pos[i].y) * 0.01;

			const dlen = Math.sqrt(disp[i].x * disp[i].x + disp[i].y * disp[i].y);
			if (dlen > 0.0001) {
				const capped = Math.min(dlen, maxStep);
				pos[i].x += (disp[i].x / dlen) * capped;
				pos[i].y += (disp[i].y / dlen) * capped;
			}
		}
	}

	const result: LayoutPositions = {};
	nodes.forEach((node, i) => {
		result[node.id] = { x: Math.round(pos[i].x), y: Math.round(pos[i].y) };
	});
	return result;
}
