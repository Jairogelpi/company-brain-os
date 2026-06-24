"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphEdge, GraphNode, NodeType } from "@/domain/graph";
import { layoutGraph, type LayoutPositions } from "./graph-layout";

export const NODE_W = 150;
export const NODE_H = 46;

/** Per-type visual signal. Monochrome base + one accent per type. */
const TYPE_STYLE: Record<NodeType, { dot: string; glyph: string }> = {
	Person: { dot: "var(--color-foreground)", glyph: "●" },
	Knowledge: { dot: "var(--color-highlighter-yellow)", glyph: "◆" },
	Process: { dot: "#34d399", glyph: "▭" },
	Asset: { dot: "#94a3b8", glyph: "▣" },
	Unit: { dot: "#60a5fa", glyph: "⬡" },
	Risk: { dot: "var(--color-destructive)", glyph: "⚠" },
	Client: { dot: "#2dd4bf", glyph: "◎" },
	Supplier: { dot: "#fb923c", glyph: "◇" },
	Project: { dot: "#a78bfa", glyph: "▲" },
	System: { dot: "#38bdf8", glyph: "⌘" },
};

type View = { tx: number; ty: number; k: number };

export type InteractiveGraphProps = {
	nodes: GraphNode[];
	edges: GraphEdge[];
	selectedId: string | null;
	onSelect: (id: string | null) => void;
	/** Called when a node is dropped after dragging — persist the new position. */
	onMoveNode: (id: string, pos: { x: number; y: number }) => void;
};

export default function InteractiveGraph({
	nodes,
	edges,
	selectedId,
	onSelect,
	onMoveNode,
}: InteractiveGraphProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [view, setView] = useState<View>({ tx: 0, ty: 0, k: 1 });
	const [overrides, setOverrides] = useState<LayoutPositions>({});
	const didFit = useRef(false);

	// Stable layout key: recompute only when the set of nodes/edges changes.
	const topoKey = useMemo(
		() =>
			nodes.map((n) => n.id).join(",") +
			"|" +
			edges.map((e) => e.id).join(","),
		[nodes, edges],
	);

	const layout = useMemo(
		() => layoutGraph(nodes, edges),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[topoKey],
	);

	const positions: LayoutPositions = useMemo(
		() => ({ ...layout, ...overrides }),
		[layout, overrides],
	);

	// Fit content to the viewport once after first layout.
	useEffect(() => {
		if (didFit.current || nodes.length === 0) return;
		const el = containerRef.current;
		if (!el) return;
		const pts = Object.values(layout);
		if (pts.length === 0) return;
		const xs = pts.map((p) => p.x);
		const ys = pts.map((p) => p.y);
		const minX = Math.min(...xs) - NODE_W;
		const maxX = Math.max(...xs) + NODE_W;
		const minY = Math.min(...ys) - NODE_H;
		const maxY = Math.max(...ys) + NODE_H;
		const w = el.clientWidth || 800;
		const h = el.clientHeight || 600;
		const k = Math.min(w / (maxX - minX), h / (maxY - minY), 1.2);
		setView({
			k,
			tx: w / 2 - ((minX + maxX) / 2) * k,
			ty: h / 2 - ((minY + maxY) / 2) * k,
		});
		didFit.current = true;
	}, [layout, nodes.length]);

	// --- Pan (drag background) + zoom (wheel) ---
	const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
		null,
	);
	// --- Node drag ---
	const dragRef = useRef<{
		id: string;
		startX: number;
		startY: number;
		origX: number;
		origY: number;
		moved: boolean;
	} | null>(null);

	function onPointerDownBackground(e: React.PointerEvent) {
		if (e.button !== 0) return;
		onSelect(null);
		panRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
		(e.target as Element).setPointerCapture?.(e.pointerId);
	}

	function onPointerMove(e: React.PointerEvent) {
		if (dragRef.current) {
			const d = dragRef.current;
			const dx = (e.clientX - d.startX) / view.k;
			const dy = (e.clientY - d.startY) / view.k;
			if (Math.abs(dx) > 1 || Math.abs(dy) > 1) d.moved = true;
			setOverrides((o) => ({
				...o,
				[d.id]: { x: d.origX + dx, y: d.origY + dy },
			}));
			return;
		}
		if (panRef.current) {
			const p = panRef.current;
			setView((v) => ({
				...v,
				tx: p.tx + (e.clientX - p.x),
				ty: p.ty + (e.clientY - p.y),
			}));
		}
	}

	function onPointerUp() {
		if (dragRef.current) {
			const d = dragRef.current;
			const pos = positions[d.id];
			if (d.moved && pos) onMoveNode(d.id, { x: Math.round(pos.x), y: Math.round(pos.y) });
			else onSelect(d.id);
			dragRef.current = null;
		}
		panRef.current = null;
	}

	function onWheel(e: React.WheelEvent) {
		e.preventDefault();
		const el = containerRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;
		const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
		setView((v) => {
			const k = Math.min(Math.max(v.k * factor, 0.2), 2.5);
			// Zoom toward the cursor.
			return {
				k,
				tx: mx - ((mx - v.tx) / v.k) * k,
				ty: my - ((my - v.ty) / v.k) * k,
			};
		});
	}

	function startNodeDrag(e: React.PointerEvent, node: GraphNode) {
		e.stopPropagation();
		if (e.button !== 0) return;
		const pos = positions[node.id];
		if (!pos) return;
		dragRef.current = {
			id: node.id,
			startX: e.clientX,
			startY: e.clientY,
			origX: pos.x,
			origY: pos.y,
			moved: false,
		};
		(e.target as Element).setPointerCapture?.(e.pointerId);
	}

	return (
		<div
			ref={containerRef}
			className="relative h-full w-full touch-none overflow-hidden bg-[var(--color-fog-gray)]"
			onPointerDown={onPointerDownBackground}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onWheel={onWheel}
			style={{ cursor: panRef.current ? "grabbing" : "grab" }}
		>
			<svg className="absolute inset-0 h-full w-full">
				<defs>
					<marker
						id="arrow"
						viewBox="0 0 10 10"
						refX="9"
						refY="5"
						markerWidth="6"
						markerHeight="6"
						orient="auto-start-reverse"
					>
						<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-ash-gray)" />
					</marker>
				</defs>
				<g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
					{edges.map((edge) => {
						const a = positions[edge.fromNodeId];
						const b = positions[edge.toNodeId];
						if (!a || !b) return null;
						const mx = (a.x + b.x) / 2;
						const my = (a.y + b.y) / 2;
						const active =
							selectedId === edge.fromNodeId || selectedId === edge.toNodeId;
						return (
							<g key={edge.id}>
								<line
									x1={a.x}
									y1={a.y}
									x2={b.x}
									y2={b.y}
									stroke={
										active ? "var(--color-foreground)" : "var(--color-ash-gray)"
									}
									strokeWidth={active ? 1.6 : 1}
									markerEnd="url(#arrow)"
								/>
								<text
									x={mx}
									y={my - 4}
									textAnchor="middle"
									className="fill-[var(--color-ash-gray)]"
									style={{ fontSize: 9, letterSpacing: "0.04em" }}
								>
									{edge.type}
								</text>
							</g>
						);
					})}

					{nodes.map((node) => {
						const p = positions[node.id];
						if (!p) return null;
						const style = TYPE_STYLE[node.type];
						const selected = node.id === selectedId;
						const critical = node.criticality === "high" || node.type === "Risk";
						return (
							<g
								key={node.id}
								transform={`translate(${p.x - NODE_W / 2} ${p.y - NODE_H / 2})`}
								onPointerDown={(e) => startNodeDrag(e, node)}
								style={{ cursor: "pointer" }}
							>
								<rect
									width={NODE_W}
									height={NODE_H}
									rx={10}
									fill="var(--color-card)"
									stroke={
										selected
											? "var(--color-highlighter-yellow)"
											: critical
												? "var(--color-destructive)"
												: "var(--color-border)"
									}
									strokeWidth={selected ? 2.5 : 1.25}
								/>
								<circle cx={16} cy={NODE_H / 2} r={5} fill={style.dot} />
								<text
									x={30}
									y={NODE_H / 2 - 4}
									className="fill-[var(--color-foreground)]"
									style={{ fontSize: 12, fontWeight: 500 }}
								>
									{truncate(node.name, 16)}
								</text>
								<text
									x={30}
									y={NODE_H / 2 + 10}
									className="fill-[var(--color-ash-gray)]"
									style={{ fontSize: 9, letterSpacing: "0.04em" }}
								>
									{node.type.toUpperCase()}
								</text>
							</g>
						);
					})}
				</g>
			</svg>

			{nodes.length === 0 && (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
					Empty graph — add a node or ask the assistant to build one.
				</div>
			)}
		</div>
	);
}

function truncate(s: string, n: number): string {
	return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
