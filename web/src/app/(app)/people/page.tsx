"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useGraph } from "@/components/useGraph";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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
			<div className="p-10 text-sm text-muted-foreground">
				{error || "Loading…"}
			</div>
		);
	}

	return (
		<div className="px-8 py-10 rise">
			<div className="flex items-end justify-between border-b border-border pb-6">
				<div>
					<div className="eyebrow">Who knows what</div>
					<h1 className="text-[44px] font-semibold tracking-[-0.045em]">People</h1>
				</div>
				<div className="text-right text-[13px] text-muted-foreground">
					<span className="numerals text-foreground">{people.length}</span>{" "}
					people
					<span className="mx-2 text-muted-foreground">·</span>
					<span className="numerals text-foreground">{skillsMapped}</span>{" "}
					skills mapped
				</div>
			</div>

			<div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{personSkills.map(({ person, skills }) => (
					<Link
						key={person.id}
						href={`/people/${person.id}`}
						className="group rounded-lg border border-border bg-card p-5 transition-transform hover:-translate-y-0.5"
					>
						<div className="flex items-center gap-3">
							<Avatar className="h-11 w-11 rounded-full bg-foreground">
								<AvatarFallback className="rounded-full bg-foreground text-base font-medium text-background">
									{person.name.charAt(0).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div>
								<div className="text-sm font-semibold text-foreground">
									{person.name}
								</div>
								<div className="eyebrow mt-0.5">
									{skills.length} skill{skills.length !== 1 ? "s" : ""}
								</div>
							</div>
							<span className="ml-auto text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-foreground">
								→
							</span>
						</div>

						{skills.length > 0 && (
							<div className="mt-4 flex flex-wrap gap-1.5">
								{skills.map((skill) => (
									<Badge key={skill.id} variant="secondary">
										{skill.name}
										<span className="ml-1 opacity-60">L{skill.level}</span>
									</Badge>
								))}
							</div>
						)}
					</Link>
				))}

				{people.length === 0 && (
					<Card className="col-span-full p-12 text-center">
						<p className="text-sm text-muted-foreground">
							No people in the graph yet.
						</p>
						<p className="eyebrow mt-2">Seed data from the Dashboard</p>
					</Card>
				)}
			</div>
		</div>
	);
}
