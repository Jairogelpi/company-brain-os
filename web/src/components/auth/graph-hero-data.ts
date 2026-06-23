export type HeroNodeType =
	| "Person"
	| "Knowledge"
	| "Process"
	| "Asset"
	| "Unit"
	| "Risk";

export type HeroNode = {
	id: string;
	label: string;
	x: number;
	y: number;
	type: HeroNodeType;
	critical?: boolean;
};

export type HeroEdge = {
	id: string;
	from: string;
	to: string;
	label: "MASTERS" | "LEARNS" | "DEPENDS_ON" | "REQUIRES";
};

// Compact coordinate space so labelled chips stay legible in the narrow
// (30%) auth hero panel. Keep nodes/edges inside the safe area.
export const HERO_VIEW_W = 320;
export const HERO_VIEW_H = 280;
export const HERO_NODE_H = 30;
export const HERO_FONT = 15;

/**
 * A curated, public-safe example that mirrors the real Company Brain graph:
 * the same node types, relationships, and a single critical knowledge node
 * (bus-factor = 1). These are illustrative, not a tenant's private data.
 */
export const HERO_NODES: HeroNode[] = [
	{ id: "marcos", label: "Marcos", x: 62, y: 60, type: "Person" },
	{ id: "laura", label: "Laura", x: 258, y: 60, type: "Person" },
	{
		id: "horno",
		label: "Horno crítico",
		x: 160,
		y: 140,
		type: "Knowledge",
		critical: true,
	},
	{ id: "pedro", label: "Pedro", x: 60, y: 218, type: "Person" },
	{ id: "produccion", label: "Producción", x: 252, y: 210, type: "Process" },
	{ id: "parada", label: "Parada planta", x: 160, y: 252, type: "Risk" },
];

export const HERO_EDGES: HeroEdge[] = [
	{ id: "e1", from: "marcos", to: "horno", label: "MASTERS" },
	{ id: "e2", from: "laura", to: "horno", label: "LEARNS" },
	{ id: "e3", from: "horno", to: "produccion", label: "REQUIRES" },
	{ id: "e4", from: "pedro", to: "produccion", label: "MASTERS" },
	{ id: "e5", from: "produccion", to: "parada", label: "DEPENDS_ON" },
];

/** Product type colours (dot accent) — mirrors the /graph view. */
export const HERO_TYPE_COLOR: Record<HeroNodeType, string> = {
	Person: "#6aa3ff",
	Knowledge: "#f59e0b",
	Process: "#34d399",
	Asset: "#cbd5e1",
	Unit: "#cbd5e1",
	Risk: "#f87171",
};

/** Approximate chip width for a label at HERO_FONT, with dot + padding. */
export function heroChipWidth(label: string): number {
	return Math.round(36 + label.length * 8.2);
}

export type RevealStep = {
	visibleNodes: number[];
	drawnEdges: number[];
	pulse: boolean;
};

export const NODE_APPEAR_INTERVAL_MS = 120;

/**
 * Builds the ordered reveal steps for the hero graph construction animation.
 * Under prefers-reduced-motion, collapses to a single static step showing
 * the full graph with the critical-node pulse already armed.
 */
export function buildRevealSteps(reducedMotion: boolean): RevealStep[] {
	if (reducedMotion) {
		return [
			{
				visibleNodes: HERO_NODES.map((_, i) => i),
				drawnEdges: HERO_EDGES.map((_, i) => i),
				pulse: true,
			},
		];
	}

	const steps: RevealStep[] = [];

	// Stagger node appearances.
	for (let i = 0; i < HERO_NODES.length; i++) {
		steps.push({
			visibleNodes: Array.from({ length: i + 1 }, (_, k) => k),
			drawnEdges: [],
			pulse: false,
		});
	}

	// Draw edges once both endpoints are visible.
	const drawnByStep: number[] = [];
	for (let ei = 0; ei < HERO_EDGES.length; ei++) {
		const edge = HERO_EDGES[ei];
		const fromIdx = HERO_NODES.findIndex((n) => n.id === edge.from);
		const toIdx = HERO_NODES.findIndex((n) => n.id === edge.to);
		const readyAt = Math.max(fromIdx, toIdx);
		drawnByStep[readyAt] = ei;
	}

	// Merge edge drawing into the existing node steps.
	for (let s = 0; s < steps.length; s++) {
		const edges = drawnByStep
			.map((ei, readyAt) => (ei !== undefined && readyAt <= s ? ei : -1))
			.filter((ei) => ei >= 0);
		steps[s].drawnEdges = edges;
	}

	// Final step: graph complete, pulse the critical node.
	steps.push({
		visibleNodes: HERO_NODES.map((_, i) => i),
		drawnEdges: HERO_EDGES.map((_, i) => i),
		pulse: true,
	});

	return steps;
}

export const CRITICAL_NODE_INDEX = HERO_NODES.findIndex((n) => n.critical);
