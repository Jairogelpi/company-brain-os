"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { computeDependencies } from "@/domain/metrics";
import { detectAllRisks } from "@/domain/risk-engine";
import { computeRiskExposure, formatMoney } from "@/domain/financial-exposure";
import { useGraph } from "@/components/useGraph";
import { CostInput } from "@/components/CostInput";

function SkillBadge({ name, level }: { name: string; level: number }) {
	const color =
		level >= 4
			? "var(--positive)"
			: level >= 3
				? "var(--cobalt)"
				: "var(--ink-3)";
	const label = level >= 4 ? "Expert" : level >= 3 ? "Proficient" : "Learning";

	return (
		<div className="panel-flat flex items-center justify-between px-4 py-3">
			<div>
				<div className="text-sm font-medium text-[var(--ink)]">{name}</div>
				<div className="eyebrow mt-0.5" style={{ color }}>
					{label}
				</div>
			</div>
			<div className="flex items-center gap-1">
				{[1, 2, 3, 4, 5].map((dot) => (
					<div
						key={dot}
						className="h-2 w-2 rounded-full"
						style={{ background: dot <= level ? color : "var(--hairline-strong)" }}
					/>
				))}
			</div>
		</div>
	);
}

export default function PersonDetailPage() {
	const params = useParams<{ id: string }>();
	const { data, error, reload } = useGraph();
	const nodes = data?.nodes ?? [];
	const edges = data?.edges ?? [];

	const person = nodes.find((n) => n.id === params.id && n.type === "Person");
	const deps = useMemo(() => computeDependencies(nodes, edges), [nodes, edges]);
	const personDeps = deps.find((d) => d.personId === params.id);

	// Total € exposure if this person leaves: risks where they're an expert,
	// de-duplicated by at-risk node.
	const personExposure = useMemo(() => {
		const risks = detectAllRisks(nodes, edges).risks.filter((r) =>
			r.relatedNodeIds.includes(params.id),
		);
		const byNode = new Map<string, number>();
		for (const r of risks) {
			const e = computeRiskExposure(r, nodes).exposure;
			byNode.set(r.sourceNodeId, Math.max(byNode.get(r.sourceNodeId) ?? 0, e));
		}
		return [...byNode.values()].reduce((a, b) => a + b, 0);
	}, [nodes, edges, params.id]);

	const skills = edges
		.filter((e) => e.type === "MASTERS" && e.fromNodeId === params.id)
		.map((e) => ({
			id: e.toNodeId,
			name: nodes.find((n) => n.id === e.toNodeId)?.name ?? e.toNodeId,
			level: (e.attributes?.level as number) ?? 0,
		}));

	const learning = edges
		.filter((e) => e.type === "LEARNS" && e.fromNodeId === params.id)
		.map((e) => ({
			id: e.toNodeId,
			name: nodes.find((n) => n.id === e.toNodeId)?.name ?? e.toNodeId,
			level: (e.attributes?.level as number) ?? 0,
		}));

	if (!data) {
		return (
			<div className="p-10 text-sm text-[var(--ink-3)]">{error || "Loading…"}</div>
		);
	}

	if (!person) {
		return (
			<div className="px-8 py-10">
				<p className="text-sm text-[var(--ink-2)]">Person not found.</p>
				<Link href="/people" className="text-sm text-[var(--cobalt)] hover:underline">
					← Back to People
				</Link>
			</div>
		);
	}

	return (
		<div className="px-8 py-10 rise">
			<Link
				href="/people"
				className="eyebrow inline-block transition-colors hover:text-[var(--cobalt)]"
			>
				← Back to People
			</Link>

			{/* Profile header */}
			<div className="mt-5 flex items-center gap-5 border-b border-[var(--hairline)] pb-7">
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ink)] font-display text-2xl font-semibold text-[var(--paper)]">
					{person.name.charAt(0).toUpperCase()}
				</div>
				<div>
					<h1 className="font-display text-3xl font-normal tracking-tight">
						{person.name}
					</h1>
					<div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-[var(--ink-2)]">
						<span>{skills.length} skills mastered</span>
						{learning.length > 0 && <span>· {learning.length} learning</span>}
						{personDeps && personDeps.dependencyScore > 0 && (
							<span className="font-medium text-[var(--risk)]">
								· Dependency score {personDeps.dependencyScore}
							</span>
						)}
					</div>
				</div>
				<Link
					href={`/simulator?person=${person.id}`}
					className="ml-auto rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--paper)] transition-colors hover:bg-[var(--cobalt-ink)]"
				>
					Simulate departure →
				</Link>
			</div>

			{/* Skills */}
			<div className="mt-8">
				<div className="eyebrow">Skills mastered</div>
				<div className="mt-3 grid gap-3 md:grid-cols-2">
					{skills.map((skill) => (
						<SkillBadge key={skill.id} name={skill.name} level={skill.level} />
					))}
					{skills.length === 0 && (
						<p className="text-sm text-[var(--ink-3)]">No skills mapped yet.</p>
					)}
				</div>
			</div>

			{/* Learning */}
			{learning.length > 0 && (
				<div className="mt-8">
					<div className="eyebrow">Currently learning</div>
					<div className="mt-3 grid gap-3 md:grid-cols-2">
						{learning.map((skill) => (
							<SkillBadge key={skill.id} name={skill.name} level={skill.level} />
						))}
					</div>
				</div>
			)}

			{/* Replacement cost editor — turns the € from estimated into real. */}
		<div className="panel mt-8 p-6">
			<div className="eyebrow">Replacement cost</div>
			<p className="mt-2 text-sm text-[var(--ink-2)]">
				Used by the simulator and the succession playbook. Leave blank to keep
				the documented defaults.
			</p>
			<div className="mt-4 grid gap-4 sm:grid-cols-2">
				<CostInput
					nodeId={person.id}
					field="replacementCost"
					value={
						person.attributes?.replacementCost as number | undefined
					}
					label="Cost to replace (€)"
					prefix="€"
					onSaved={reload}
				/>
				<CostInput
					nodeId={person.id}
					field="replacementWeeks"
					value={
						person.attributes?.replacementWeeks as number | undefined
					}
					label="Weeks to replace"
					prefix="wk "
					onSaved={reload}
				/>
			</div>
		</div>

		{/* Critical dependency */}
			{personDeps && personDeps.dependencyScore > 0 && (
				<div className="panel tick-left mt-8 p-6">
					<div className="eyebrow text-[var(--risk)]">If they leave</div>
					{personExposure > 0 && (
						<div className="numerals mt-2 text-4xl font-light text-[var(--risk)]">
							{formatMoney(personExposure)}
						</div>
					)}
					<p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
						{person.name} is the sole expert for{" "}
						<span className="font-semibold">{personDeps.dependencyScore}</span>{" "}
						critical area(s). If they leave, these areas lose all expertise.
					</p>
				</div>
			)}
		</div>
	);
}
