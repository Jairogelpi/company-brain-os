import {
	HERO_EDGES,
	HERO_FONT,
	HERO_NODE_H,
	HERO_NODES,
	HERO_TYPE_COLOR,
	HERO_VIEW_H,
	HERO_VIEW_W,
	heroChipWidth,
} from "./graph-hero-data";

export type NodeAnim = { opacity: number; scale: number };
export type EdgeAnim = { progress: number }; // 0..1 opacity + dash draw

export type HeroGraphSvgProps = {
	nodes: NodeAnim[];
	edges: EdgeAnim[];
	/** Critical-node pulse phase 0..1 (0 = no pulse). */
	pulse: number;
};

const YELLOW = "var(--color-highlighter-yellow)";

/**
 * Pure presentational SVG of the curated "real" Company Brain graph: labelled
 * type-coloured chips, relationship edges, and a pulsing critical node. Shared
 * by the Remotion composition (frame-driven) and the static fallback
 * (step-driven) so both render identically.
 */
export default function HeroGraphSvg({
	nodes,
	edges,
	pulse,
}: HeroGraphSvgProps) {
	return (
		<svg
			viewBox={`0 0 ${HERO_VIEW_W} ${HERO_VIEW_H}`}
			width="100%"
			height="100%"
			style={{ color: "var(--color-background)" }}
			aria-hidden
		>
			{/* edges */}
			{HERO_EDGES.map((edge, i) => {
				const from = HERO_NODES.find((n) => n.id === edge.from)!;
				const to = HERO_NODES.find((n) => n.id === edge.to)!;
				const length = Math.hypot(to.x - from.x, to.y - from.y);
				const progress = edges[i]?.progress ?? 0;
				return (
					<line
						key={edge.id}
						x1={from.x}
						y1={from.y}
						x2={to.x}
						y2={to.y}
						stroke="currentColor"
						strokeWidth={1.25}
						strokeOpacity={progress * 0.35}
						strokeDasharray={length}
						strokeDashoffset={length * (1 - progress)}
					/>
				);
			})}

			{/* nodes */}
			{HERO_NODES.map((node, i) => {
				const { opacity, scale } = nodes[i] ?? { opacity: 0, scale: 1 };
				const w = heroChipWidth(node.label);
				const h = HERO_NODE_H;
				const isCritical = !!node.critical;

				return (
					<g
						key={node.id}
						transform={`translate(${node.x} ${node.y}) scale(${scale})`}
						style={{ opacity }}
					>
						{isCritical && pulse > 0 && (
							<rect
								x={-w / 2 - pulse * 10}
								y={-h / 2 - pulse * 10}
								width={w + pulse * 20}
								height={h + pulse * 20}
								rx={(h + pulse * 20) / 2}
								fill="none"
								stroke={YELLOW}
								strokeWidth={1.5}
								opacity={0.6 * (1 - pulse)}
							/>
						)}
						<rect
							x={-w / 2}
							y={-h / 2}
							width={w}
							height={h}
							rx={h / 2}
							fill={isCritical ? "rgba(251,255,43,0.12)" : "rgba(255,255,255,0.05)"}
							stroke={isCritical ? YELLOW : "currentColor"}
							strokeWidth={1.25}
						/>
						<circle
							cx={-w / 2 + 14}
							cy={0}
							r={3.5}
							fill={HERO_TYPE_COLOR[node.type]}
						/>
						<text
							x={-w / 2 + 24}
							y={0}
							dominantBaseline="central"
							fontSize={HERO_FONT}
							fill={isCritical ? YELLOW : "currentColor"}
							style={{
								fontFamily: "inherit",
								fontWeight: isCritical ? 600 : 500,
							}}
						>
							{node.label}
						</text>
					</g>
				);
			})}
		</svg>
	);
}
