"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import LangToggle from "@/components/ui/LangToggle";
import { useLang } from "./LanguageContext";

/* ---- Animated network canvas ---- */

const NODE_DATA: [number, number, number, number][] = [
	[0.18, 0.45, 0.05, 1],
	[0.46, 0.05, 0.012, 0],
	[0.78, 0.2, 0.026, 0],
	[0.07, 0.2, 0.011, 0],
	[0.4, 0.255, 0.01, 0],
	[0.56, 0.25, 0.02, 0],
	[0.58, 0.45, 0.01, 0],
	[0.76, 0.44, 0.024, 0],
	[0.62, 0.5, 0.008, 0],
	[0.5, 0.57, 0.019, 0],
	[0.33, 0.61, 0.01, 0],
	[0.58, 0.65, 0.02, 0],
	[0.12, 0.79, 0.019, 0],
	[0.58, 0.81, 0.04, 1],
	[0.84, 0.6, 0.016, 0],
];

type NodeState = {
	bx: number; by: number; rFrac: number; core: boolean;
	ax: number; ay: number; sx: number; sy: number;
	px: number; py: number; pulse: number; pspeed: number;
	ox: number; oy: number;
};

function NetworkCanvas() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rafRef = useRef<number>(0);
	const ptrRef = useRef<{ mx: number | null; my: number | null }>({ mx: null, my: null });

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let w = 0, h = 0, dpr = 1;
		const resize = () => {
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			const r = canvas.getBoundingClientRect();
			w = r.width; h = r.height;
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		window.addEventListener("resize", resize);

		const hero = canvas.parentElement;
		const ptr = ptrRef.current;
		const onMove = (e: PointerEvent) => {
			const r = canvas.getBoundingClientRect();
			ptr.mx = e.clientX - r.left;
			ptr.my = e.clientY - r.top;
		};
		const onLeave = () => { ptr.mx = null; ptr.my = null; };
		hero?.addEventListener("pointermove", onMove as EventListener);
		hero?.addEventListener("pointerleave", onLeave);

		const nodes: NodeState[] = NODE_DATA.map(([bx, by, rFrac, core]) => ({
			bx, by, rFrac, core: core === 1,
			ax: 0.006 + Math.random() * 0.008,
			ay: 0.006 + Math.random() * 0.008,
			sx: 0.18 + Math.random() * 0.25,
			sy: 0.18 + Math.random() * 0.25,
			px: Math.random() * 6.28,
			py: Math.random() * 6.28,
			pulse: Math.random() * 6.28,
			pspeed: 0.7 + Math.random() * 0.6,
			ox: 0, oy: 0,
		}));

		const edges: [number, number][] = [];
		const dist = (a: NodeState, b: NodeState) =>
			Math.hypot(a.bx - b.bx, a.by - b.by);
		for (let i = 0; i < nodes.length; i++) {
			for (let j = i + 1; j < nodes.length; j++) {
				const d = dist(nodes[i], nodes[j]);
				let connect = d < 0.3;
				if ((i === 0 || j === 0) && d < 0.62) connect = true;
				if ((i === 13 || j === 13) && d < 0.42) connect = true;
				if (connect) edges.push([i, j]);
			}
		}

		type Pulse = { e: [number, number]; t0: number };
		const pulses: Pulse[] = [];
		let lastSpawn = 0;
		const start = performance.now();

		const getPos = (t: number) => {
			const bx = w * 0.3, by = h * 0.04;
			const bw = w * 0.66, bh = h * 0.92;
			const scl = Math.min(bw, bh);
			return nodes.map((nd) => ({
				x: bx + (nd.bx + Math.sin(t * nd.sx + nd.px) * nd.ax) * bw,
				y: by + (nd.by + Math.cos(t * nd.sy + nd.py) * nd.ay) * bh,
				r: nd.rFrac * scl,
				nd,
			}));
		};

		const draw = (now: number) => {
			const t = (now - start) / 1000;
			ctx.clearRect(0, 0, w, h);
			const P = getPos(t);

			for (const p of P) {
				let tx = 0, ty = 0;
				if (ptr.mx != null && ptr.my != null) {
					const dx = ptr.mx - p.x, dy = ptr.my - p.y;
					const d = Math.hypot(dx, dy) || 1;
					const pull = Math.min(70, 6000 / d);
					tx = (dx / d) * pull; ty = (dy / d) * pull;
				}
				p.nd.ox += (tx - p.nd.ox) * 0.055;
				p.nd.oy += (ty - p.nd.oy) * 0.055;
				p.x += p.nd.ox; p.y += p.nd.oy;
			}

			ctx.globalCompositeOperation = "lighter";

			for (const [i, j] of edges) {
				const a = P[i], b = P[j];
				const isHub = i === 0 || j === 0 || i === 13 || j === 13;
				const flick = 0.5 + 0.5 * Math.sin(t * 0.6 + i + j);
				const alpha = (isHub ? 0.28 : 0.18) + flick * 0.08;
				ctx.beginPath();
				ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
				ctx.strokeStyle = `rgba(200,215,240,${alpha})`;
				ctx.lineWidth = isHub ? 0.9 : 0.6;
				ctx.stroke();
			}

			if (t - lastSpawn > 0.85 && edges.length) {
				const hub = edges.filter((e) => e[0] === 0 || e[1] === 0 || e[0] === 13 || e[1] === 13);
				const pool = Math.random() < 0.7 && hub.length ? hub : edges;
				pulses.push({ e: pool[Math.floor(Math.random() * pool.length)], t0: t });
				lastSpawn = t;
			}

			const LIFE = 1.9;
			for (let k = pulses.length - 1; k >= 0; k--) {
				const pu = pulses[k];
				const prog = (t - pu.t0) / LIFE;
				if (prog >= 1) { pulses.splice(k, 1); continue; }
				const a = P[pu.e[0]], b = P[pu.e[1]];
				const x = a.x + (b.x - a.x) * prog;
				const y = a.y + (b.y - a.y) * prog;
				const fade = Math.sin(prog * Math.PI);
				const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
				g.addColorStop(0, `rgba(235,242,255,${0.85 * fade})`);
				g.addColorStop(1, "rgba(235,242,255,0)");
				ctx.fillStyle = g;
				ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.2832); ctx.fill();
			}

		for (let ni = 0; ni < P.length; ni++) {
				const p = P[ni];
				const breath = 0.78 + 0.22 * Math.sin(t * p.nd.pspeed + p.nd.pulse);
				const r = p.r;
				const isCore = p.nd.core;
				const isTitleNode = ni === 9;
				const gr = r * (isCore ? 5.2 : isTitleNode ? 4.8 : 4.2);
				const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
				glow.addColorStop(0, isCore ? `rgba(220,230,248,${0.68 * breath})` : isTitleNode ? `rgba(245,250,255,${0.88 * breath})` : `rgba(225,235,250,${0.72 * breath})`);
				glow.addColorStop(0.18, isCore ? `rgba(195,212,238,${0.45 * breath})` : isTitleNode ? `rgba(220,235,250,${0.58 * breath})` : `rgba(195,212,238,${0.45 * breath})`);
				glow.addColorStop(1, isCore ? "rgba(160,185,215,0)" : isTitleNode ? "rgba(185,210,240,0)" : "rgba(155,178,210,0)");
				ctx.fillStyle = glow;
				ctx.beginPath(); ctx.arc(p.x, p.y, gr, 0, 6.2832); ctx.fill();
				const core = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 0, p.x, p.y, r);
				core.addColorStop(0, isCore ? `rgba(240,245,252,${0.82 * breath})` : isTitleNode ? `rgba(255,255,255,${0.96 * breath})` : `rgba(245,248,255,${0.92 * breath})`);
				core.addColorStop(0.7, isCore ? `rgba(220,232,248,${0.72 * breath})` : isTitleNode ? `rgba(240,248,255,${0.88 * breath})` : `rgba(225,235,250,${0.82 * breath})`);
				core.addColorStop(1, isCore ? `rgba(185,200,228,${0.48 * breath})` : isTitleNode ? `rgba(210,228,250,${0.62 * breath})` : `rgba(185,200,228,${0.52 * breath})`);
				ctx.fillStyle = core;
				ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fill();
			}

			ctx.globalCompositeOperation = "source-over";
			rafRef.current = requestAnimationFrame(draw);
		};

		rafRef.current = requestAnimationFrame(draw);

		return () => {
			cancelAnimationFrame(rafRef.current);
			window.removeEventListener("resize", resize);
			hero?.removeEventListener("pointermove", onMove as EventListener);
			hero?.removeEventListener("pointerleave", onLeave);
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			style={{
				position: "absolute", inset: 0,
				width: "100%", height: "100%",
				zIndex: 2,
			}}
		/>
	);
}

/* ---- Shell layout ---- */

export default function AuthShell({
	children,
}: {
	children: ReactNode;
}) {
	const { t } = useLang();
	return (
		<div
			style={{
				display: "flex",
				width: "100%",
				minHeight: "100vh",
				background: "#f4f5f7",
				fontFamily: "var(--font-archivo, 'Archivo', -apple-system, sans-serif)",
				overflow: "hidden",
				color: "#fff",
			}}
		>
			<style>{`
				@keyframes auth-chrome {
					0%   { background-position: 0% 50%; }
					50%  { background-position: 100% 50%; }
					100% { background-position: 0% 50%; }
				}
				@keyframes auth-fadeup {
					from { opacity: 0; transform: translateY(18px); }
					to   { opacity: 1; transform: translateY(0); }
				}
				@keyframes auth-fadein {
					from { opacity: 0; }
					to   { opacity: 1; }
				}
					@keyframes auth-panel {
					from { opacity: 0; transform: translateX(26px); }
					to   { opacity: 1; transform: translateX(0); }
				}
				@keyframes auth-breath {
					0%, 100% { opacity: 0.40; transform: scale(1); }
					50%      { opacity: 0.65; transform: scale(1.03); }
				}
				.auth-chrome-text {
					background: linear-gradient(108deg,#7e8794 0%,#dfe4ea 16%,#ffffff 30%,#c2c9d2 44%,#ffffff 56%,#aab2bd 72%,#7c8593 100%);
					background-size: 260% 100%;
					-webkit-background-clip: text;
					background-clip: text;
					-webkit-text-fill-color: transparent;
					color: transparent;
					-webkit-text-stroke: 0.5px rgba(40,46,54,0.35);
					filter: drop-shadow(0 2px 4px rgba(0,0,0,0.9)) drop-shadow(0 0 24px rgba(140,170,210,0.50)) drop-shadow(0 0 8px rgba(180,200,230,0.30));
				}

					/* === AUTH RESPONSIVE — driven by injected CSS, not Tailwind JIT === */

				/* Hero panel: hidden by default, only shows on wide screens */
				.auth-hero-panel {
					display: none !important;
				}
				@media (min-width: 1280px) {
					.auth-hero-panel {
						display: flex !important;
					}
					.auth-mobile-logo {
						display: none !important;
					}
				}

				/* Form aside: full-width on mobile, fixed on desktop */
				.auth-panel-aside {
					width: 100%;
					padding: 48px 32px;
				}
				@media (min-width: 1280px) {
					.auth-panel-aside {
						width: 560px;
						flex-shrink: 0;
					}
				}

				/* Card padding responsive */
				.auth-panel-card {
					padding: 44px 40px 40px;
				}
				@media (max-width: 479px) {
					.auth-panel-aside {
						padding: 20px 12px;
					}
					.auth-panel-card {
						padding: 28px 20px 24px;
						border-radius: 16px;
					}
				}
				@media (min-width: 480px) and (max-width: 1279px) {
					.auth-panel-aside {
						padding: 48px 40px;
						display: flex;
						flex-direction: column;
						align-items: center;
						justify-content: center;
					}
					.auth-panel-card {
						width: 100%;
						max-width: 460px;
					}
				}
			`}</style>

			{/* LEFT HERO — only shown via .auth-hero-panel CSS (≥1280px) */}
			<section
				className="auth-hero-panel"
				style={{
					position: "relative",
					flex: "1 1 auto",
					minWidth: 0,
					overflow: "hidden",
					background: "radial-gradient(120% 100% at 70% 45%, #141619 0%, #0b0c0e 55%, #08090b 100%)",
					viewTransitionName: "auth-hero",
				}}
			>
				{/* Ambient glow */}
				<div style={{ position: "absolute", top: "42%", left: "62%", width: "46%", height: "60%", transform: "translate(-50%,-50%)", borderRadius: "50%", background: "radial-gradient(circle, rgba(110,130,160,0.09) 0%, rgba(90,110,140,0.03) 40%, rgba(0,0,0,0) 70%)", filter: "blur(8px)", zIndex: 1, animation: "auth-breath 9s ease-in-out infinite" }} />

				<NetworkCanvas />

				{/* Scrim — strong behind title, fades to show nodes on right */}
				<div style={{ position: "absolute", inset: "0 30% 0 0", zIndex: 3, pointerEvents: "none", background: "linear-gradient(90deg, rgba(8,9,11,0.97) 0%, rgba(8,9,11,0.93) 35%, rgba(8,9,11,0.55) 62%, rgba(8,9,11,0) 88%)" }} />

				{/* Logo */}
				<div style={{ position: "absolute", top: 34, left: 48, zIndex: 4, display: "flex", alignItems: "center", gap: 13 }}>
					<svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ filter: "drop-shadow(0 0 4px rgba(140,160,190,0.3))" }}>
						<circle cx="15" cy="15" r="11" stroke="#e8edf3" strokeWidth="1.6" opacity="0.9" />
						<circle cx="11" cy="12" r="2" fill="#e8edf3" />
						<circle cx="19.5" cy="11" r="1.5" fill="#e8edf3" />
						<circle cx="17" cy="19" r="2.4" fill="#e8edf3" />
						<line x1="11" y1="12" x2="19.5" y2="11" stroke="#e8edf3" strokeWidth="0.9" opacity="0.6" />
						<line x1="11" y1="12" x2="17" y2="19" stroke="#e8edf3" strokeWidth="0.9" opacity="0.6" />
						<line x1="19.5" y1="11" x2="17" y2="19" stroke="#e8edf3" strokeWidth="0.9" opacity="0.6" />
					</svg>
					<span style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: "#f2f4f7" }}>Company Brain</span>
				</div>

				{/* Hero copy */}
				<div style={{ position: "absolute", top: "50%", left: 48, transform: "translateY(-50%)", zIndex: 4, maxWidth: 980 }}>
					<h1 style={{ margin: 0, fontWeight: 900, fontSize: "clamp(58px, 7.8vw, 128px)", lineHeight: 0.95, letterSpacing: "-0.04em", whiteSpace: "nowrap" }}>
						<span
							className="auth-chrome-text"
							style={{ display: "block", animation: "auth-chrome 8s ease-in-out infinite" }}
						>
							Know who
						</span>
						<span
							className="auth-chrome-text"
							style={{ display: "block", animation: "auth-chrome 8s ease-in-out 0.4s infinite" }}
						>
							knows what
						</span>
					</h1>
					<p style={{ margin: "26px 0 0", maxWidth: 340, fontSize: 18, lineHeight: 1.45, fontWeight: 400, color: "#9aa0a9" }}>
						Map critical knowledge dependencies and discover single points of failure.
					</p>
				</div>
			</section>

			{/* RIGHT FORM PANEL */}
			<aside
				className="auth-panel-aside"
				style={{
					position: "relative",
					background: "#f4f5f7",
					color: "#0c0d0f",
					display: "flex",
					flexDirection: "column",
					minHeight: "100vh",
					viewTransitionName: "auth-panel",
				}}
			>
				{/* Lang toggle */}
				<div style={{ position: "absolute", top: 20, right: 20, zIndex: 10 }}>
					<LangToggle />
				</div>

				{/* Mobile logo — hidden via CSS at ≥1280px */}
				<div
					className="auth-mobile-logo"
					style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}
				>
					<div style={{ width: 32, height: 32, borderRadius: 8, background: "#0c0d0f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "#fff", fontWeight: 600 }}>◐</div>
					<span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: "#0c0d0f" }}>Company Brain</span>
				</div>

				<div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
					<div
						className="auth-panel-card"
						style={{
							background: "#ffffff",
							border: "1px solid rgba(18,20,24,0.06)",
							borderRadius: 22,
							boxShadow: "0 1px 2px rgba(16,18,22,0.04), 0 18px 50px -12px rgba(16,18,22,0.18)",
							maxWidth: 440,
							width: "100%",
							viewTransitionName: "auth-card",
						}}
					>
						{children}
					</div>
				</div>

				<div
					style={{
						fontSize: 12,
						letterSpacing: "0.02em",
						color: "#9aa0a9",
						textAlign: "center",
						padding: "0 8px",
						lineHeight: 1.6,
						wordBreak: "break-word",
					}}
				>
					<span style={{ fontWeight: 700, color: "#3a3d42", letterSpacing: "0.1em" }}>COMPANY BRAIN</span>
					{" "}&middot;{" "}{t.footerSub}
				</div>
			</aside>
		</div>
	);
}
