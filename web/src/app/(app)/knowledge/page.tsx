"use client";

import { useMemo, useState } from "react";
import { computeBusFactors } from "@/domain/metrics";
import { useGraph } from "@/components/useGraph";

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
			<div className="p-10 text-sm text-[var(--ink-3)]">{error || "Loading…"}</div>
		);
	}

	return (
		<div className="px-8 py-10 rise">
			<div className="flex items-end justify-between border-b border-[var(--hairline)] pb-6">
				<div>
					<div className="eyebrow">Institutional memory</div>
					<h1 className="mt-2 font-display text-4xl font-normal tracking-tight">
						Knowledge
					</h1>
				</div>
				<div className="text-right text-[13px] text-[var(--ink-2)]">
					<span className="numerals text-[var(--ink)]">{knowledge.length}</span>{" "}
					areas documented
				</div>
			</div>

			{/* Search */}
			<div className="mt-6">
				<input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search knowledge areas…"
					className="w-full max-w-md rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none transition-all placeholder:text-[var(--ink-3)] focus:border-[var(--cobalt)] focus:ring-2 focus:ring-[var(--cobalt)]/15"
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
					const bfColor =
						busFactor === 0
							? "var(--risk)"
							: busFactor === 1
								? "var(--gold)"
								: "var(--positive)";

					return (
						<div
							key={k.id}
							className="panel p-5 transition-transform hover:-translate-y-0.5"
						>
							<div className="text-sm font-semibold text-[var(--ink)]">
								{k.name}
							</div>
							<div className="mt-2 flex flex-wrap gap-1.5">
								<Tag>{k.type}</Tag>
								{critical && <Tag tone="risk">Critical</Tag>}
								<Tag tone={documented ? "ok" : "risk"}>
									{documented ? "Documented" : "Undocumented"}
								</Tag>
							</div>

							{/* Bus factor */}
							<div className="mt-4">
								<div className="flex items-center justify-between">
									<span className="eyebrow">Bus factor</span>
									<span
										className="numerals text-base font-medium"
										style={{ color: bfColor }}
									>
										{busFactor}
									</span>
								</div>
								<div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--paper-2)]">
									<div
										className="h-full rounded-full transition-all"
										style={{
											background: bfColor,
											width:
												busFactor === 0
													? "6%"
													: busFactor === 1
														? "30%"
														: "80%",
										}}
									/>
								</div>
							</div>

							{experts.length > 0 && (
								<div className="mt-4">
									<div className="eyebrow">Experts</div>
									<div className="mt-1 text-xs text-[var(--ink)]">
										{experts.join(", ")}
									</div>
								</div>
							)}
						</div>
					);
				})}

				{filtered.length === 0 && (
					<div className="panel-flat col-span-full p-12 text-center">
						<p className="text-sm text-[var(--ink-2)]">
							{search
								? "No knowledge areas match your search."
								: "No knowledge areas yet."}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

function Tag({
	children,
	tone,
}: {
	children: React.ReactNode;
	tone?: "risk" | "ok";
}) {
	const color =
		tone === "risk"
			? "var(--risk)"
			: tone === "ok"
				? "var(--positive)"
				: "var(--ink-2)";
	return (
		<span
			className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
			style={{ borderColor: "var(--hairline-strong)", color }}
		>
			{children}
		</span>
	);
}
