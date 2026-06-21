"use client";

import { useEffect, useRef, useState } from "react";
import {
	HERO_NODES,
	HERO_EDGES,
	buildRevealSteps,
	CRITICAL_NODE_INDEX,
	type RevealStep,
} from "./graph-hero-data";

const STEP_MS = 120;
const PULSE_LOOP_MS = 1600;

function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function GraphHero() {
	const [reduced] = useState(prefersReducedMotion);
	const [step, setStep] = useState(0);
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		if (reduced) {
			setStep(0);
			return;
		}

		const steps = buildRevealSteps(false);
		let index = 0;
		let lastTs = 0;

		const tick = (ts: number) => {
			if (lastTs === 0) lastTs = ts;
			if (ts - lastTs >= STEP_MS) {
				index = (index + 1) % steps.length;
				setStep(index);
				lastTs = ts;
			}
			rafRef.current = requestAnimationFrame(tick);
		};

		rafRef.current = requestAnimationFrame(tick);
		return () => {
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
		};
	}, [reduced]);

	const current: RevealStep =
		buildRevealSteps(reduced)[
			Math.min(step, buildRevealSteps(reduced).length - 1)
		];
	const visible = new Set(current.visibleNodes);
	const drawn = new Set(current.drawnEdges);

	return (
		<svg
			viewBox="0 0 600 520"
			className="h-full w-full text-background"
			aria-hidden
		>
			{/* edges */}
			{HERO_EDGES.map((edge, i) => {
				const from = HERO_NODES.find((n) => n.id === edge.from)!;
				const to = HERO_NODES.find((n) => n.id === edge.to)!;
				const isDrawn = drawn.has(i);
				return (
					<line
						key={edge.id}
						x1={from.x}
						y1={from.y}
						x2={to.x}
						y2={to.y}
						stroke="currentColor"
						strokeWidth={1.5}
						strokeOpacity={isDrawn ? 0.4 : 0}
						style={{
							transition: reduced
								? "none"
								: "stroke-opacity 250ms ease, stroke-dashoffset 250ms ease",
						}}
					/>
				);
			})}

			{/* nodes */}
			{HERO_NODES.map((node, i) => {
				const isVisible = visible.has(i);
				const isCritical = i === CRITICAL_NODE_INDEX;
				return (
					<g
						key={node.id}
						transform={`translate(${node.x} ${node.y})`}
						style={{
							opacity: isVisible ? 1 : 0,
							transition: reduced ? "none" : "opacity 250ms ease",
						}}
					>
						<circle
							r={14}
							stroke="currentColor"
							strokeWidth={1.5}
							fill={
								isCritical
									? "var(--color-highlighter-yellow)"
									: "var(--color-card)"
							}
						/>
						{isCritical && current.pulse && (
							<circle
								r={14}
								stroke="var(--color-highlighter-yellow)"
								strokeWidth={2}
								fill="none"
								style={
									reduced
										? { opacity: 0.6 }
										: {
												animation: `graph-hero-pulse ${PULSE_LOOP_MS}ms ease-out infinite`,
											}
								}
							/>
						)}
					</g>
				);
			})}

			<style>{`
				@keyframes graph-hero-pulse {
					from { r: 14; opacity: 0.6; }
					to { r: 26; opacity: 0; }
				}
				@media (prefers-reduced-motion: reduce) {
					@keyframes graph-hero-pulse { from, to { r: 14; opacity: 0.6; } }
				}
			`}</style>
		</svg>
	);
}
