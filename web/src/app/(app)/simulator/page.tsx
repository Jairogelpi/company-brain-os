"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useGraph } from "@/components/useGraph";
import {
	simulatePersonLeaving,
	simulateMultipleLeaving,
} from "@/domain/simulator";
import { simulateDeepImpact } from "@/domain/advanced-features";
import { simulationExposure } from "@/domain/simulation-exposure";
import { formatMoney } from "@/domain/financial-exposure";

function Simulator() {
	const params = useSearchParams();
	const { data, error } = useGraph();
	const nodes = data?.nodes ?? [];
	const edges = data?.edges ?? [];
	const people = nodes.filter((n) => n.type === "Person");

	const [selected, setSelected] = useState<Set<string>>(
		() => new Set(params.get("person") ? [params.get("person") as string] : []),
	);

	const sim = useMemo(() => {
		const ids = [...selected].filter((id) => nodes.some((n) => n.id === id));
		if (ids.length === 0 || !data) return null;
		const report =
			ids.length === 1
				? simulatePersonLeaving(nodes, edges, ids[0])
				: simulateMultipleLeaving(nodes, edges, ids);
		const exposure = simulationExposure(report, nodes);

		// Cascade: merge second-order impacts across the removed people.
		const indirect = new Map<string, { name: string; path: string[] }>();
		for (const id of ids) {
			for (const imp of simulateDeepImpact(nodes, edges, id).indirectImpacts) {
				if (!indirect.has(imp.nodeId))
					indirect.set(imp.nodeId, { name: imp.nodeName, path: imp.path });
			}
		}
		return { report, exposure, indirect: [...indirect.values()] };
	}, [selected, nodes, edges, data]);

	const toggle = (id: string) =>
		setSelected((s) => {
			const n = new Set(s);
			n.has(id) ? n.delete(id) : n.add(id);
			return n;
		});

	if (!data) {
		return <div className="p-10 text-sm text-[var(--ink-3)]">{error || "Loading…"}</div>;
	}

	const orphaned = sim?.report.knowledgeImpacts.filter((k) => k.impact === "lost") ?? [];
	const halted = sim?.report.processImpacts.filter((p) => p.impact === "broken") ?? [];
	const weakened = sim?.report.processImpacts.filter((p) => p.impact === "weakened") ?? [];

	return (
		<div className="px-8 py-10 rise">
			<div className="border-b border-[var(--hairline)] pb-6">
				<h1 className="font-display text-4xl font-normal tracking-tight">
					Departure simulator
				</h1>
				<p className="mt-2 max-w-xl text-sm text-[var(--ink-2)]">
					Select who disappears and see — instantly — what breaks, what knowledge
					is orphaned, and what it costs. Nothing is changed.
				</p>
			</div>

			<div className="mt-8 grid gap-6 lg:grid-cols-5">
				{/* People picker */}
				<div className="lg:col-span-2">
					<div className="eyebrow mb-3">Remove people</div>
					<div className="panel divide-y divide-[var(--hairline)]">
						{people.map((p) => (
							<label
								key={p.id}
								className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm"
							>
								<input
									type="checkbox"
									checked={selected.has(p.id)}
									onChange={() => toggle(p.id)}
								/>
								<span className="text-[var(--ink)]">{p.name}</span>
							</label>
						))}
						{people.length === 0 && (
							<div className="px-4 py-3 text-sm text-[var(--ink-3)]">
								No people in the graph.
							</div>
						)}
					</div>
				</div>

				{/* Result */}
				<div className="lg:col-span-3">
					{!sim ? (
						<div className="panel-flat p-12 text-center text-sm text-[var(--ink-2)]">
							Select one or more people to simulate their departure.
						</div>
					) : (
						<div className="space-y-5">
							{/* Hero € */}
							<div className="panel tick-left p-6">
								<div className="eyebrow text-[var(--risk)]">Newly at risk</div>
								<div className="numerals mt-2 text-5xl font-light text-[var(--risk)]">
									{formatMoney(sim.exposure.total)}
								</div>
								<p className="mt-2 text-sm text-[var(--ink-2)]">
									{sim.report.summary.message}
								</p>
							</div>

							<div className="grid gap-4 sm:grid-cols-2">
								<Panel title="Orphaned knowledge" tone="risk" items={orphaned.map((k) => k.knowledgeName)} empty="None" />
								<Panel title="Halted processes" tone="risk" items={halted.map((p) => p.processName)} empty="None" />
							</div>

							{weakened.length > 0 && (
								<Panel title="Weakened processes" items={weakened.map((p) => p.processName)} empty="None" />
							)}

							{/* Cascade */}
							<div className="panel p-5">
								<div className="eyebrow">Cascade (second-order)</div>
								{sim.indirect.length === 0 ? (
									<p className="mt-2 text-sm text-[var(--ink-3)]">
										No downstream cascade detected.
									</p>
								) : (
									<ul className="mt-3 space-y-2">
										{sim.indirect.map((i) => (
											<li key={i.name} className="text-sm">
												<span className="text-[var(--ink)]">{i.name}</span>
												{i.path.length > 0 && (
													<span className="text-[var(--ink-3)]">
														{" "}
														· via {i.path.join(" → ")}
													</span>
												)}
											</li>
										))}
									</ul>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function Panel({
	title,
	items,
	empty,
	tone,
}: {
	title: string;
	items: string[];
	empty: string;
	tone?: "risk";
}) {
	return (
		<div className="panel p-5">
			<div className="eyebrow" style={tone === "risk" ? { color: "var(--risk)" } : undefined}>
				{title}
			</div>
			{items.length === 0 ? (
				<p className="mt-2 text-sm text-[var(--ink-3)]">{empty}</p>
			) : (
				<ul className="mt-2 space-y-1">
					{items.map((i) => (
						<li key={i} className="text-sm text-[var(--ink)]">
							{i}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export default function SimulatorPage() {
	return (
		<Suspense>
			<Simulator />
		</Suspense>
	);
}
