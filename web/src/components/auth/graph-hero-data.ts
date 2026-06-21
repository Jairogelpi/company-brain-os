export type HeroNode = {
	id: string;
	x: number;
	y: number;
	type: "Person" | "Knowledge" | "Process" | "Asset" | "Unit" | "Risk";
	critical?: boolean;
};

export type HeroEdge = {
	id: string;
	from: string;
	to: string;
	label: "MASTERS" | "DEPENDS_ON" | "REQUIRES";
};

export const HERO_NODES: HeroNode[] = [
	{ id: "pedro", x: 120, y: 160, type: "Person" },
	{ id: "llenadora", x: 300, y: 100, type: "Knowledge", critical: true },
	{ id: "produccion", x: 300, y: 260, type: "Process" },
	{ id: "laura", x: 120, y: 340, type: "Person" },
	{ id: "planta", x: 480, y: 180, type: "Unit" },
	{ id: "parada", x: 480, y: 340, type: "Risk" },
	{ id: "manual", x: 300, y: 420, type: "Asset" },
];

export const HERO_EDGES: HeroEdge[] = [
	{ id: "e1", from: "pedro", to: "llenadora", label: "MASTERS" },
	{ id: "e2", from: "laura", to: "llenadora", label: "MASTERS" },
	{ id: "e3", from: "llenadora", to: "produccion", label: "DEPENDS_ON" },
	{ id: "e4", from: "produccion", to: "planta", label: "REQUIRES" },
	{ id: "e5", from: "planta", to: "parada", label: "DEPENDS_ON" },
	{ id: "e6", from: "pedro", to: "produccion", label: "MASTERS" },
	{ id: "e7", from: "llenadora", to: "manual", label: "REQUIRES" },
	{ id: "e8", from: "laura", to: "produccion", label: "MASTERS" },
];

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
