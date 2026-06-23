"use client";

import { useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import GraphHero from "./GraphHero";
import {
	GraphHeroComposition,
	HERO_COMPOSITION,
} from "./remotion/GraphHeroComposition";

function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Hero graph animation driven by Remotion. Falls back to the lightweight static
 * SVG (GraphHero) during SSR/first paint and whenever the user prefers reduced
 * motion. Playback is started imperatively because autoPlay is unreliable when
 * the player mounts off-screen / without a user gesture.
 */
export default function GraphHeroPlayer() {
	const [mounted, setMounted] = useState(false);
	const [reduced] = useState(prefersReducedMotion);
	const playerRef = useRef<PlayerRef>(null);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!mounted || reduced) return;
		// A bare play() right after mount does not reliably engage the player's
		// rAF clock; seeking to 0 first kicks it off. Defer one frame so the
		// imperative handle is fully wired.
		const raf = requestAnimationFrame(() => {
			playerRef.current?.seekTo(0);
			playerRef.current?.play();
		});
		return () => cancelAnimationFrame(raf);
	}, [mounted, reduced]);

	// Static SVG for SSR/first paint and reduced-motion users.
	if (!mounted || reduced) {
		return <GraphHero />;
	}

	return (
		<Player
			ref={playerRef}
			component={GraphHeroComposition}
			durationInFrames={HERO_COMPOSITION.durationInFrames}
			fps={HERO_COMPOSITION.fps}
			compositionWidth={HERO_COMPOSITION.width}
			compositionHeight={HERO_COMPOSITION.height}
			autoPlay
			loop
			controls={false}
			clickToPlay={false}
			doubleClickToFullscreen={false}
			numberOfSharedAudioTags={0}
			acknowledgeRemotionLicense
			style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
		/>
	);
}
