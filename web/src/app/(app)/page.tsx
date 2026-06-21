"use client";

import { useMemo, useState } from "react";
import { computeAllMetrics } from "@/domain/metrics";
import { detectAllRisks } from "@/domain/risk-engine";
import {
	computeTotalExposure,
	computeRiskExposure,
	formatMoney,
} from "@/domain/financial-exposure";
import { useAuth } from "@/components/auth/AuthProvider";
import { useGraph } from "@/components/useGraph";
import Link from "next/link";

export default function HomePage() {
	const { can } = useAuth();
	const { data, error, reload } = useGraph();
	const [seeding, setSeeding] = useState(false);

	const seed = async () => {
		setSeeding(true);
		await fetch("/api/graph", { method: "POST" });
		await reload();
		setSeeding(false);
	};

	const nodes = data?.nodes ?? [];
	const edges = data?.edges ?? [];
	const metrics = useMemo(() => computeAllMetrics(nodes, edges), [nodes, edges]);
	const risks = useMemo(() => detectAllRisks(nodes, edges), [nodes, edges]);
	const totalExposure = useMemo(
		() => computeTotalExposure(risks.risks, nodes),
		[risks, nodes],
	);

	const people = nodes.filter((n) => n.type === "Person");
	const knowledge = nodes.filter((n) => n.type === "Knowledge");

	if (!data) {
		return (
			<div className="p-10 text-sm text-[var(--ink-3)]">{error || "Loading…"}</div>
		);
	}

	if (nodes.length === 0) {
		return (
			<div className="mx-auto max-w-2xl px-8 py-24 text-center rise">
				<div className="eyebrow">Organizational intelligence</div>
				<h1 className="mt-3 font-display text-4xl font-normal">
					Nothing captured yet
				</h1>
				<p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--ink-2)]">
					Your knowledge graph is empty. Seed it with a sample organization to
					see coverage, risks, and bus-factor analysis in action.
				</p>
				{can("user.invite") ? (
					<button
						onClick={seed}
						disabled={seeding}
						className="mt-7 rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-[var(--paper)] transition-colors hover:bg-[var(--cobalt-ink)] disabled:opacity-50"
					>
						{seeding ? "Seeding…" : "Seed demo data"}
					</button>
				) : (
					<p className="mt-6 eyebrow">Ask an owner to seed initial data</p>
				)}
			</div>
		);
	}

	const stats = [
		{
			label: "Coverage",
			value: `${metrics.coverage.coveragePercent}%`,
			sub: `${metrics.coverage.coveredCritical}/${metrics.coverage.totalCritical} critical covered`,
			tick: "var(--positive)",
		},
		{
			label: "Health",
			value: `${metrics.health.overallScore}`,
			sub: "out of 100",
			tick: "var(--cobalt)",
		},
		{
			label: "Company IQ",
			value: `${metrics.companyIQ.iq}%`,
			sub: `${metrics.companyIQ.documentedAndValidated}/${metrics.companyIQ.totalKnowledge} validated`,
			tick: "var(--gold)",
		},
		{
			label: "Exposure at risk",
			value: formatMoney(totalExposure.total),
			sub: `${risks.summary.total} open · ${risks.summary.critical} critical`,
			tick: "var(--risk)",
		},
	];

	const links = [
		{ href: "/people", label: "People", desc: "See who knows what" },
		{ href: "/knowledge", label: "Knowledge", desc: "Browse knowledge areas" },
		{ href: "/graph", label: "Graph", desc: "Visualize the network" },
	];

	return (
		<div className="px-8 py-10 rise">
			{/* Masthead */}
			<div className="flex items-end justify-between border-b border-[var(--hairline)] pb-6">
				<div>
					<h1 className="font-display text-4xl font-normal tracking-tight">
						Company Brain
					</h1>
				</div>
				<div className="text-right text-[13px] text-[var(--ink-2)]">
					<span className="numerals text-[var(--ink)]">{people.length}</span>{" "}
					people
					<span className="mx-2 text-[var(--hairline-strong)]">·</span>
					<span className="numerals text-[var(--ink)]">
						{knowledge.length}
					</span>{" "}
					knowledge areas
				</div>
			</div>

			{/* Stat row */}
			<div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--hairline)] md:grid-cols-4">
				{stats.map((s) => (
					<div key={s.label} className="bg-[var(--surface)] p-6">
						<div className="flex items-center gap-2">
							<span
								className="h-1.5 w-1.5 rounded-full"
								style={{ background: s.tick }}
							/>
							<span className="text-xs font-medium text-[var(--ink-2)]">{s.label}</span>
						</div>
						<div className="numerals mt-4 text-5xl font-light text-[var(--ink)]">
							{s.value}
						</div>
						<div className="mt-2 text-xs text-[var(--ink-2)]">{s.sub}</div>
					</div>
				))}
			</div>

			{/* Quick links + top risk */}
			<div className="mt-6 grid gap-6 lg:grid-cols-5">
				<div className="grid gap-3 sm:grid-cols-3 lg:col-span-3">
					{links.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className="panel group p-5 transition-transform hover:-translate-y-0.5"
						>
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium text-[var(--ink)]">
									{link.label}
								</span>
								<span className="text-[var(--ink-3)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--cobalt)]">
									→
								</span>
							</div>
							<div className="mt-1 text-xs text-[var(--ink-2)]">{link.desc}</div>
						</Link>
					))}
				</div>

				<div className="panel tick-left p-6 lg:col-span-2">
					<div className="eyebrow text-[var(--risk)]">Most pressing risk</div>
					{risks.risks.length > 0 ? (
						<>
							<div className="numerals mt-3 text-3xl font-light text-[var(--risk)]">
								{formatMoney(computeRiskExposure(risks.risks[0], nodes).exposure)}
							</div>
							<p className="mt-2 text-sm font-medium leading-relaxed text-[var(--ink)]">
								{risks.risks[0].message}
							</p>
							<Link
								href="/graph"
								className="mt-4 inline-block text-xs font-medium text-[var(--cobalt)] hover:underline"
							>
								Investigate →
							</Link>
						</>
					) : (
						<p className="mt-3 text-sm text-[var(--ink-2)]">
							No open risks detected.
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
