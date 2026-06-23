import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import {
	HERO_EDGES,
	HERO_NODES,
	HERO_VIEW_H,
	HERO_VIEW_W,
} from "../graph-hero-data";
import HeroGraphSvg, {
	type EdgeAnim,
	type NodeAnim,
} from "../HeroGraphSvg";

/**
 * Remotion composition that rebuilds the curated, domain-representative Company
 * Brain graph (see graph-hero-data.ts). The auth pages are public, so this is a
 * public-safe example, not live tenant data.
 *
 * Animation is fully frame-driven via useCurrentFrame()/interpolate() — no CSS
 * transitions or keyframes, per Remotion rendering rules.
 */

export const HERO_COMPOSITION = {
	width: HERO_VIEW_W,
	height: HERO_VIEW_H,
	fps: 30,
	durationInFrames: 150,
} as const;

const STAGGER = 9; // frames between successive node reveals
const NODE_APPEAR = 14; // fade/scale-in duration per node
const EDGE_DRAW = 16; // edge draw duration
const PULSE_PERIOD = 48; // critical-node pulse loop length

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

const nodeAppearFrame = (index: number) => index * STAGGER;

function edgeReadyFrame(fromId: string, toId: string): number {
	const fromIdx = HERO_NODES.findIndex((n) => n.id === fromId);
	const toIdx = HERO_NODES.findIndex((n) => n.id === toId);
	return Math.max(nodeAppearFrame(fromIdx), nodeAppearFrame(toIdx)) + NODE_APPEAR;
}

const GRAPH_COMPLETE_FRAME =
	(HERO_NODES.length - 1) * STAGGER + NODE_APPEAR + EDGE_DRAW;

export const GraphHeroComposition: React.FC = () => {
	const frame = useCurrentFrame();

	const nodes: NodeAnim[] = HERO_NODES.map((_, i) => {
		const appear = nodeAppearFrame(i);
		const range: [number, number] = [appear, appear + NODE_APPEAR];
		return {
			opacity: interpolate(frame, range, [0, 1], {
				extrapolateLeft: "clamp",
				extrapolateRight: "clamp",
				easing: EASE_OUT,
			}),
			scale: interpolate(frame, range, [0.7, 1], {
				extrapolateLeft: "clamp",
				extrapolateRight: "clamp",
				easing: EASE_OUT,
			}),
		};
	});

	const edges: EdgeAnim[] = HERO_EDGES.map((edge) => {
		const start = edgeReadyFrame(edge.from, edge.to);
		return {
			progress: interpolate(frame, [start, start + EDGE_DRAW], [0, 1], {
				extrapolateLeft: "clamp",
				extrapolateRight: "clamp",
				easing: EASE_OUT,
			}),
		};
	});

	const pulse =
		frame >= GRAPH_COMPLETE_FRAME
			? ((frame - GRAPH_COMPLETE_FRAME) % PULSE_PERIOD) / PULSE_PERIOD
			: 0;

	return (
		<AbsoluteFill style={{ backgroundColor: "transparent" }}>
			<HeroGraphSvg nodes={nodes} edges={edges} pulse={pulse} />
		</AbsoluteFill>
	);
};
