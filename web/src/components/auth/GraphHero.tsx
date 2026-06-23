"use client";

import { HERO_EDGES, HERO_NODES } from "./graph-hero-data";
import HeroGraphSvg from "./HeroGraphSvg";

/**
 * Static, fully-revealed render of the curated Company Brain graph. Used as the
 * SSR/first-paint placeholder and the prefers-reduced-motion fallback for
 * GraphHeroPlayer (the animated Remotion version).
 */
export default function GraphHero() {
	const nodes = HERO_NODES.map(() => ({ opacity: 1, scale: 1 }));
	const edges = HERO_EDGES.map(() => ({ progress: 1 }));
	return <HeroGraphSvg nodes={nodes} edges={edges} pulse={0.25} />;
}
