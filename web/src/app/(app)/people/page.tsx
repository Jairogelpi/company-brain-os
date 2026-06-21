"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useGraph } from "@/components/useGraph";

export default function PeoplePage() {
	const { data, error } = useGraph();
	const nodes = data?.nodes ?? [];
	const edges = data?.edges ?? [];

	const people = nodes.filter((n) => n.type === "Person");
	const skillsMapped = edges.filter((e) => e.type === "MASTERS").length;

	const personSkills = useMemo(
		() =>
			people.map((person) => ({
				person,
				skills: edges
					.filter((e) => e.type === "MASTERS" && e.fromNodeId === person.id)
					.map((e) => {
						const k = nodes.find((n) => n.id === e.toNodeId);
						return {
							id: e.toNodeId,
							name: k?.name ?? e.toNodeId,
							level: (e.attributes?.level as number) ?? 0,
						};
					}),
			})),
		[nodes, edges, people],
	);

	if (!data) {
		return (
			<div className="p-10 text-sm text-[var(--ink-3)]">{error || "Loading…"}</div>
		);
	}

	return (
		<div className="px-8 py-10 rise">
			<div className="flex items-end justify-between border-b border-[var(--hairline)] pb-6">
				<div>
					<div className="eyebrow">Who knows what</div>
					<h1 className="mt-2 font-display text-4xl font-normal tracking-tight">
						People
					</h1>
				</div>
				<div className="text-right text-[13px] text-[var(--ink-2)]">
					<span className="numerals text-[var(--ink)]">{people.length}</span>{" "}
					people
					<span className="mx-2 text-[var(--hairline-strong)]">·</span>
					<span className="numerals text-[var(--ink)]">{skillsMapped}</span>{" "}
					skills mapped
				</div>
			</div>

			<div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{personSkills.map(({ person, skills }) => (
					<Link
						key={person.id}
						href={`/people/${person.id}`}
						className="panel group p-5 transition-transform hover:-translate-y-0.5"
					>
						<div className="flex items-center gap-3">
							<div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ink)] font-display text-base font-semibold text-[var(--paper)]">
								{person.name.charAt(0).toUpperCase()}
							</div>
							<div>
								<div className="text-sm font-semibold text-[var(--ink)]">
									{person.name}
								</div>
								<div className="eyebrow mt-0.5">
									{skills.length} skill{skills.length !== 1 ? "s" : ""}
								</div>
							</div>
							<span className="ml-auto text-[var(--ink-3)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--cobalt)]">
								→
							</span>
						</div>

						{skills.length > 0 && (
							<div className="mt-4 flex flex-wrap gap-1.5">
								{skills.map((skill) => (
									<span
										key={skill.id}
										className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
										style={{
											borderColor:
												skill.level >= 4
													? "var(--positive)"
													: skill.level >= 3
														? "var(--cobalt)"
														: "var(--hairline-strong)",
											color:
												skill.level >= 4
													? "var(--positive)"
													: skill.level >= 3
														? "var(--cobalt-ink)"
														: "var(--ink-2)",
										}}
									>
										{skill.name}
										<span className="opacity-60">L{skill.level}</span>
									</span>
								))}
							</div>
						)}
					</Link>
				))}

				{people.length === 0 && (
					<div className="panel-flat col-span-full p-12 text-center">
						<p className="text-sm text-[var(--ink-2)]">
							No people in the graph yet.
						</p>
						<p className="eyebrow mt-2">Seed data from the Dashboard</p>
					</div>
				)}
			</div>
		</div>
	);
}
