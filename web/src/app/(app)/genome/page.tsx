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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const CATEGORY_BAR: Record<GenomeCategory, string> = {
	rule: "bg-foreground",
	value: "bg-muted-foreground",
	policy: "bg-muted",
};

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
			<div className="p-10 text-sm text-muted-foreground">
				{error || "Loading…"}
			</div>
		);
	}

	const stats = [
		{
			label: "Genome Health",
			value: health.score,
			sub: "out of 100",
			progress: health.score,
			risk: health.score < 40,
		},
		{
			label: "Rules",
			value: report.summary.totalRules,
			sub: "captured",
			progress: Math.min(report.summary.totalRules * 10, 100),
			risk: false,
		},
		{
			label: "Values",
			value: report.summary.totalValues,
			sub: "captured",
			progress: Math.min(report.summary.totalValues * 10, 100),
			risk: false,
		},
		{
			label: "Policies",
			value: report.summary.totalPolicies,
			sub: "captured",
			progress: Math.min(report.summary.totalPolicies * 10, 100),
			risk: false,
		},
	];

	return (
		<div className="px-8 py-10 rise">
			<div className="border-b border-border pb-6">
				<div className="eyebrow">Cultural DNA</div>
				<h1 className="mt-2 text-4xl font-normal tracking-tight">
					Company Genome
				</h1>
				<p className="mt-2 max-w-xl text-sm text-muted-foreground">
					Unwritten rules, values, and policies — the knowledge that lives only
					in people&apos;s heads.
				</p>
			</div>

			<div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
				{stats.map((s) => (
					<Card key={s.label} className="p-6">
						<CardContent className="p-0">
							<div className="flex items-center gap-2">
								<span
									className={`h-1.5 w-1.5 rounded-full ${s.risk ? "bg-destructive" : "bg-muted-foreground"}`}
								/>
								<span className="eyebrow">{s.label}</span>
							</div>
							<div
								className={`numerals mt-4 text-5xl font-light ${s.risk ? "text-destructive" : "text-foreground"}`}
							>
								{s.value}
							</div>
							<div className="mt-2 text-xs text-muted-foreground">{s.sub}</div>
							<Progress value={s.progress} className="mt-3 h-1.5" />
						</CardContent>
					</Card>
				))}
			</div>

			<Card className="mt-6 p-6">
				<CardContent className="p-0">
					<div className="eyebrow">Health breakdown</div>
					<div className="mt-3 space-y-2">
						{health.breakdown.map((line, i) => (
							<div
								key={i}
								className="flex items-center gap-2 text-sm text-muted-foreground"
							>
								<span className="text-foreground">•</span>
								{line}
							</div>
						))}
					</div>
					{report.summary.atRisk > 0 && (
						<div className="mt-4 rounded-xl border border-destructive bg-destructive/5 p-3">
							<p className="text-sm font-medium text-destructive">
								{report.summary.atRisk} genome entr
								{report.summary.atRisk === 1 ? "y" : "ies"} at risk —
								undocumented with bus factor ≤ 1.
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			<div className="mt-6 space-y-3">
				{report.entries.length === 0 && (
					<Card className="p-12 text-center">
						<p className="text-sm text-muted-foreground">
							No unwritten rules, values, or policies captured yet.
						</p>
					</Card>
				)}

				{report.entries.map((entry) => (
					<Card
						key={entry.knowledgeId}
						className="relative overflow-hidden p-5"
					>
						<span
							className={`absolute left-0 top-0 h-full w-1 ${CATEGORY_BAR[entry.category]}`}
						/>
						<CardContent className="p-0 pl-2">
							<div className="flex items-start justify-between gap-4">
								<div className="flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<span>{getCategoryIcon(entry.category)}</span>
										<span className="text-sm font-semibold text-foreground">
											{entry.name}
										</span>
										<Badge variant="secondary">
											{getCategoryLabel(entry.category)}
										</Badge>
									</div>
									<p className="mt-2 text-sm text-muted-foreground">
										{entry.description}
									</p>
									{entry.expertNames.length > 0 && (
										<div className="mt-3 flex flex-wrap gap-1.5">
											{entry.expertNames.map((name) => (
												<Badge key={name} variant="secondary">
													{name}
												</Badge>
											))}
										</div>
									)}
								</div>

								<div className="flex items-center gap-5 text-center">
									<div>
										<div className="eyebrow">Bus</div>
										<div
											className={`numerals mt-1 text-lg font-medium ${entry.busFactor === 0 ? "text-destructive" : "text-foreground"}`}
										>
											{entry.busFactor}
										</div>
									</div>
									<div>
										<div className="eyebrow">Conf.</div>
										<div className="numerals mt-1 text-lg font-medium text-foreground">
											{entry.confidence}%
										</div>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
