"use client";

import { useMemo, useState } from "react";
import GraphCanvas from "@/canvas/GraphCanvas";
import { hydrateGraphService } from "@/domain/hydrate-graph";
import { useGraph } from "@/components/useGraph";

const TYPE_COLOR: Record<string, string> = {
	Person: "var(--cobalt)",
	Knowledge: "var(--gold)",
	Process: "var(--positive)",
	Asset: "#7c5cff",
	Unit: "var(--ink-3)",
	Risk: "var(--risk)",
};

export default function GraphPage() {
	const { data, error } = useGraph();
	const [syncVersion] = useState(0);

	const service = useMemo(
		() => (data ? hydrateGraphService(data.nodes, data.edges) : null),
		[data],
	);

	if (!data || !service) {
		return (
			<div className="p-10 text-sm text-[var(--ink-3)]">{error || "Loading…"}</div>
		);
	}

	const nodeTypes = [...new Set(data.nodes.map((n) => n.type))];

	return (
		<div className="flex h-screen flex-col">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-[var(--hairline)] bg-[var(--paper)]/70 px-8 py-4 backdrop-blur-sm">
				<div>
					<div className="eyebrow">Living network</div>
					<h1 className="font-display text-xl font-normal">Knowledge Graph</h1>
					<p className="mt-0.5 text-xs text-[var(--ink-2)]">
						{data.nodes.length} nodes · {data.edges.length} edges
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{nodeTypes.map((type) => (
						<span
							key={type}
							className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium text-[var(--ink-2)]"
							style={{ borderColor: "var(--hairline-strong)" }}
						>
							<span
								className="h-1.5 w-1.5 rounded-full"
								style={{ background: TYPE_COLOR[type] ?? "var(--ink-3)" }}
							/>
							{type}
						</span>
					))}
				</div>
			</div>

			{/* Canvas */}
			<div className="flex-1">
				<GraphCanvas service={service} syncVersion={syncVersion} />
			</div>
		</div>
	);
}
