"use client";

import { useMemo } from "react";
import { computeAllMetrics } from "@/domain/metrics";
import { detectAllRisks } from "@/domain/risk-engine";
import {
	computeTotalExposure,
	computeRiskExposure,
	formatMoney,
} from "@/domain/financial-exposure";
import { useGraph } from "@/components/useGraph";
import { useLang } from "@/components/auth/LanguageContext";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function HomePage() {
	const { data, error } = useGraph();
	const { t } = useLang();

	const nodes = data?.nodes ?? [];
	const edges = data?.edges ?? [];
	const metrics = useMemo(
		() => computeAllMetrics(nodes, edges),
		[nodes, edges],
	);
	const risks = useMemo(() => detectAllRisks(nodes, edges), [nodes, edges]);
	const totalExposure = useMemo(
		() => computeTotalExposure(risks.risks, nodes),
		[risks, nodes],
	);

	const people = nodes.filter((n) => n.type === "Person");
	const knowledge = nodes.filter((n) => n.type === "Knowledge");

	if (!data) {
		return (
			<div className="p-10 text-sm text-muted-foreground">
				{error || t.loading}
			</div>
		);
	}

	if (nodes.length === 0) {
		return (
			<div className="mx-auto max-w-2xl px-8 py-24 text-center rise">
				<div className="eyebrow">{t.orgIntel}</div>
				<h1 className="mt-3 text-[44px] font-semibold tracking-[-0.045em]">
					{t.nothingCaptured}
				</h1>
				<p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
					{t.emptyGraph}
				</p>
				<p className="mt-6 text-sm text-muted-foreground">
					{t.askOwner}
				</p>
			</div>
		);
	}

	const stats = [
		{
			label: t.coverage,
			value: `${metrics.coverage.coveragePercent}%`,
			sub: `${metrics.coverage.coveredCritical}/${metrics.coverage.totalCritical} ${t.criticalCovered}`,
			progress: metrics.coverage.coveragePercent,
			risk: false,
		},
		{
			label: t.health,
			value: `${metrics.health.overallScore}`,
			sub: t.outOf100,
			progress: metrics.health.overallScore,
			risk: false,
		},
		{
			label: t.companyIQ,
			value: `${metrics.companyIQ.iq}%`,
			sub: `${metrics.companyIQ.documentedAndValidated}/${metrics.companyIQ.totalKnowledge} ${t.validated}`,
			progress: metrics.companyIQ.iq,
			risk: false,
		},
		{
			label: t.exposureAtRisk,
			value: formatMoney(totalExposure.total),
			sub: `${risks.summary.total} ${t.open} · ${risks.summary.critical} ${t.critical}`,
			progress: Math.min(risks.summary.total * 10, 100),
			risk: true,
		},
	];

	const links = [
		{ href: "/people", label: t.people, desc: t.seeWhoKnows },
		{ href: "/knowledge", label: t.knowledge, desc: t.browseKnowledge },
		{ href: "/graph", label: t.graph, desc: t.visualizeNetwork },
	];

	return (
		<div className="px-8 py-10 rise">
			<div className="flex items-end justify-between border-b border-border pb-6">
				<h1 className="text-[44px] font-semibold tracking-[-0.045em]">Company Brain</h1>
				<div className="text-right text-[13px] text-muted-foreground">
					<span className="numerals text-foreground">{people.length}</span>{" "}
					{t.people.toLowerCase()}
					<span className="mx-2 text-muted-foreground">·</span>
					<span className="numerals text-foreground">{knowledge.length}</span>{" "}
					{t.knowledgeAreas}
				</div>
			</div>

			<div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
				{stats.map((s) => (
					<Card key={s.label} className="p-6">
						<CardContent className="p-0">
							<div className="flex items-center gap-2">
								<span
									className={`h-1.5 w-1.5 rounded-full ${s.risk ? "bg-destructive" : "bg-muted-foreground"}`}
								/>
								<span className="text-xs font-medium text-muted-foreground">
									{s.label}
								</span>
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

			<div className="mt-6 grid gap-6 lg:grid-cols-5">
				<div className="grid gap-3 sm:grid-cols-3 lg:col-span-3">
					{links.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className="group rounded-lg border border-border bg-card p-5 transition-transform hover:-translate-y-0.5"
						>
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium text-foreground">
									{link.label}
								</span>
								<span className="text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-foreground">
									→
								</span>
							</div>
							<div className="mt-1 text-xs text-muted-foreground">
								{link.desc}
							</div>
						</Link>
					))}
				</div>

				<Card className="border-l-2 border-l-destructive p-6 lg:col-span-2">
					<CardContent className="p-0">
						<div className="eyebrow text-destructive">{t.mostPressingRisk}</div>
						{risks.risks.length > 0 ? (
							<>
								<div className="numerals mt-3 text-3xl font-light text-destructive">
									{formatMoney(
										computeRiskExposure(risks.risks[0], nodes).exposure,
									)}
								</div>
								<p className="mt-2 text-sm font-medium leading-relaxed text-foreground">
									{risks.risks[0].message}
								</p>
								<div className="mt-3 flex flex-wrap gap-1.5">
									<Badge variant="destructive">
										{risks.risks[0].severity ?? t.risk}
									</Badge>
								</div>
								<Link
									href="/graph"
									className="mt-4 inline-block text-xs font-medium text-foreground hover:underline"
								>
									{t.investigate}
								</Link>
							</>
						) : (
							<p className="mt-3 text-sm text-muted-foreground">
								{t.noOpenRisks}
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
