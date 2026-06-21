"use client";

import { useMemo } from "react";
import {
	generateGenomeReport,
	computeGenomeHealth,
	getCategoryIcon,
	getCategoryLabel,
	type GenomeCategory,
} from "@/domain/genome";
import { useGraph } from "@/components/useGraph";

const CATEGORY_TINT: Record<GenomeCategory, string> = {
	rule: "var(--gold)",
	value: "#7c5cff",
	policy: "var(--cobalt)",
};

const busColor = (bf: number) =>
	bf === 0 ? "var(--risk)" : bf === 1 ? "var(--gold)" : "var(--positive)";

export default function GenomePage() {
	const { data, error } = useGraph();
	const nodes = data?.nodes ?? [];
	const edges = data?.edges ?? [];

	const report = useMemo(
		() => generateGenomeReport(nodes, edges),
		[nodes, edges],
	);
	const health = useMemo(
		() => computeGenomeHealth(nodes, edges),
		[nodes, edges],
	);

	if (!data) {
		return (
			<div className="p-10 text-sm text-[var(--ink-3)]">{error || "Loading…"}</div>
		);
	}

	const stats = [
		{
			label: "Genome Health",
			value: health.score,
			sub: "out of 100",
			tick:
				health.score >= 70
					? "var(--positive)"
					: health.score >= 40
						? "var(--gold)"
						: "var(--risk)",
		},
		{ label: "Rules", value: report.summary.totalRules, sub: "captured", tick: "var(--gold)" },
		{ label: "Values", value: report.summary.totalValues, sub: "captured", tick: "#7c5cff" },
		{ label: "Policies", value: report.summary.totalPolicies, sub: "captured", tick: "var(--cobalt)" },
	];

	return (
		<div className="px-8 py-10 rise">
			<div className="border-b border-[var(--hairline)] pb-6">
				<div className="eyebrow">Cultural DNA</div>
				<h1 className="mt-2 font-display text-4xl font-normal tracking-tight">
					Company Genome
				</h1>
				<p className="mt-2 max-w-xl text-sm text-[var(--ink-2)]">
					Unwritten rules, values, and policies — the knowledge that lives only
					in people&apos;s heads.
				</p>
			</div>

			{/* Stats */}
			<div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--hairline)] md:grid-cols-4">
				{stats.map((s) => (
					<div key={s.label} className="bg-[var(--surface)] p-6">
						<div className="flex items-center gap-2">
							<span className="h-1.5 w-1.5 rounded-full" style={{ background: s.tick }} />
							<span className="eyebrow">{s.label}</span>
						</div>
						<div className="numerals mt-4 text-5xl font-light">{s.value}</div>
						<div className="mt-2 text-xs text-[var(--ink-2)]">{s.sub}</div>
					</div>
				))}
			</div>

			{/* Health breakdown */}
			<div className="panel mt-6 p-6">
				<div className="eyebrow">Health breakdown</div>
				<div className="mt-3 space-y-2">
					{health.breakdown.map((line, i) => (
						<div
							key={i}
							className="flex items-center gap-2 text-sm text-[var(--ink-2)]"
						>
							<span className="text-[var(--positive)]">•</span>
							{line}
						</div>
					))}
				</div>
				{report.summary.atRisk > 0 && (
					<div className="mt-4 rounded-xl border border-[var(--risk)]/30 bg-[var(--risk)]/5 p-3">
						<p className="text-sm font-medium text-[var(--risk)]">
							{report.summary.atRisk} genome entr
							{report.summary.atRisk === 1 ? "y" : "ies"} at risk — undocumented
							with bus factor ≤ 1.
						</p>
					</div>
				)}
			</div>

			{/* Entries */}
			<div className="mt-6 space-y-3">
				{report.entries.length === 0 && (
					<div className="panel-flat p-12 text-center">
						<p className="text-sm text-[var(--ink-2)]">
							No unwritten rules, values, or policies captured yet.
						</p>
					</div>
				)}

				{report.entries.map((entry) => (
					<div key={entry.knowledgeId} className="panel relative overflow-hidden p-5">
						<span
							className="absolute left-0 top-0 h-full w-1"
							style={{ background: CATEGORY_TINT[entry.category] }}
						/>
						<div className="flex items-start justify-between gap-4 pl-2">
							<div className="flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<span>{getCategoryIcon(entry.category)}</span>
									<span className="text-sm font-semibold text-[var(--ink)]">
										{entry.name}
									</span>
									<span
										className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-[var(--ink-2)]"
										style={{ borderColor: "var(--hairline-strong)" }}
									>
										{getCategoryLabel(entry.category)}
									</span>
								</div>
								<p className="mt-2 text-sm text-[var(--ink-2)]">
									{entry.description}
								</p>
								{entry.expertNames.length > 0 && (
									<div className="mt-3 flex flex-wrap gap-1.5">
										{entry.expertNames.map((name) => (
											<span
												key={name}
												className="rounded-full border px-2 py-0.5 text-[11px] text-[var(--ink-2)]"
												style={{ borderColor: "var(--hairline-strong)" }}
											>
												{name}
											</span>
										))}
									</div>
								)}
							</div>

							<div className="flex items-center gap-5 text-center">
								<div>
									<div className="eyebrow">Bus</div>
									<div
										className="numerals mt-1 text-lg font-medium"
										style={{ color: busColor(entry.busFactor) }}
									>
										{entry.busFactor}
									</div>
								</div>
								<div>
									<div className="eyebrow">Conf.</div>
									<div className="numerals mt-1 text-lg font-medium text-[var(--ink)]">
										{entry.confidence}%
									</div>
								</div>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
