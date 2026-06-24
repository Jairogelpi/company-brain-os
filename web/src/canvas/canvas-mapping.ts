import { createShapeId, toRichText } from "tldraw";

import type { GraphNode, GraphEdge, NodeType } from "@/domain/graph";

// --- Shape mapping (pure functions, testable in isolation) ---
// tldraw v3+: geo/arrow labels live in `props.richText` (not `props.text`),
// and arrows use point terminals (we draw center-to-center, no bindings).

type Position = { x: number; y: number };

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;

// ponytail: tldraw's built-in color palette — use these, no custom
const TLDRAW_COLORS = [
	"black",
	"grey",
	"white",
	"blue",
	"light-blue",
	"orange",
	"green",
	"light-green",
	"violet",
	"light-violet",
	"red",
	"light-red",
	"yellow",
] as const;

export type TldrawColor = (typeof TLDRAW_COLORS)[number];

const COLOR_MAP: Record<NodeType, TldrawColor> = {
	Person: "blue",
	Knowledge: "orange",
	Process: "green",
	Asset: "violet",
	Unit: "grey",
	Risk: "red",
	Client: "light-blue",
	Supplier: "light-red",
	Project: "light-violet",
	System: "light-green",
	Document: "grey",
};

export function getNodeColor(nodeType: string): TldrawColor {
	return (COLOR_MAP as Record<string, TldrawColor>)[nodeType] ?? "black";
}

/** Human-readable label encoded into a shape ("Type: Name"). */
export function nodeLabel(node: GraphNode): string {
	return `${node.type}: ${node.name}`;
}

export function nodeToShape(node: GraphNode, pos: Position) {
	return {
		id: createShapeId(node.id),
		type: "geo" as const,
		x: pos.x,
		y: pos.y,
		props: {
			geo: "rectangle" as const,
			color: getNodeColor(node.type),
			w: NODE_WIDTH,
			h: NODE_HEIGHT,
			richText: toRichText(nodeLabel(node)),
		},
	};
}

/**
 * Arrow from the source node's centre to the target node's centre.
 * ponytail: static point terminals, not bindings — this is a read-mostly
 * visualization, so arrows don't need to re-anchor on drag.
 */
export function edgeToShape(
	edge: GraphEdge,
	sourceShape: ReturnType<typeof nodeToShape>,
	targetShape: ReturnType<typeof nodeToShape>,
) {
	const sx = sourceShape.x + NODE_WIDTH / 2;
	const sy = sourceShape.y + NODE_HEIGHT / 2;
	const tx = targetShape.x + NODE_WIDTH / 2;
	const ty = targetShape.y + NODE_HEIGHT / 2;
	return {
		id: createShapeId(edge.id),
		type: "arrow" as const,
		x: sx,
		y: sy,
		props: {
			color: "black" as const,
			richText: toRichText(edge.type),
			start: { x: 0, y: 0 },
			end: { x: tx - sx, y: ty - sy },
		},
	};
}
