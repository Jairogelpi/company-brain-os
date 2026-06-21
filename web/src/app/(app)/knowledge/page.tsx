"use client";

import { useMemo, useState } from "react";
import { computeBusFactors } from "@/domain/metrics";
import { useGraph } from "@/components/useGraph";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";

export default function KnowledgePage() {
	const { data, error } = useGraph();
	const nodes = data?.nodes ?? [];
	const edges = data?.edges ?? [];
	const busFactors = useMemo(
		() => computeBusFactors(nodes, edges),
		[nodes, edges],
	);

	const knowledge = nodes.filter((n) => n.type === "Knowledge");
	const [search, setSearch] = useState("");

	const filtered = search.trim()
		? knowledge.filter((k) =>
				k.name.toLowerCase().includes(search.toLowerCase()),
			)
		: knowledge;

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
					<div className="eyebrow">Institutional memory</div>
					<h1 className="mt-2 text-4xl font-normal tracking-tight">Knowledge</h1>
				</div>
				<div className="text-right text-[13px] text-muted-foreground">
					<span className="numerals text-foreground">{knowledge.length}</span>{" "}
					areas documented
				</div>
			</div>

			<div className="mt-6">
				<Input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search knowledge areas…"
					className="max-w-md"
				/>
			</div>

			<div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{filtered.map((k) => {
					const bf = busFactors.find((b) => b.knowledgeId === k.id);
					const busFactor = bf?.busFactor ?? 0;
					const experts = (bf?.expertIds ?? []).map(
						(id) => nodes.find((n) => n.id === id)?.name ?? id,
					);
					const documented = (k as { documented?: boolean }).documented;
					const critical =
						(k as { criticality?: string }).criticality === "high";
					const isBusZero = busFactor === 0;

					return (
						<Card key={k.id} className="p-5 transition-transform hover:-translate-y-0.5">
							<CardContent className="p-0">
								<div className="text-sm font-semibold text-foreground">
									{k.name}
								</div>
								<div className="mt-2 flex flex-wrap gap-1.5">
									<Badge variant="secondary">{k.type}</Badge>
									{critical && <Badge variant="destructive">Critical</Badge>}
									<Badge variant={documented ? "secondary" : "destructive"}>
										{documented ? "Documented" : "Undocumented"}
									</Badge>
								</div>

								<div className="mt-4">
									<div className="flex items-center justify-between">
										<span className="eyebrow">Bus factor</span>
										<span
											className={`numerals text-base font-medium ${isBusZero ? "text-destructive" : "text-foreground"}`}
										>
											{busFactor}
										</span>
									</div>
									<Progress
										value={busFactor === 0 ? 6 : busFactor === 1 ? 30 : 80}
										className="mt-1.5 h-1.5"
									/>
								</div>

								{experts.length > 0 && (
									<div className="mt-4">
										<div className="eyebrow">Experts</div>
										<div className="mt-1 text-xs text-foreground">
											{experts.join(", ")}
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					);
				})}

				{filtered.length === 0 && (
					<Card className="col-span-full p-12 text-center">
						<p className="text-sm text-muted-foreground">
							{search
								? "No knowledge areas match your search."
								: "No knowledge areas yet."}
						</p>
					</Card>
				)}
			</div>
		</div>
	);
}
