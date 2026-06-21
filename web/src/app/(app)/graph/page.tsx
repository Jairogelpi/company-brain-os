"use client";

import { useMemo, useState } from "react";
import GraphCanvas from "@/canvas/GraphCanvas";
import { hydrateGraphService } from "@/domain/hydrate-graph";
import { useGraph } from "@/components/useGraph";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TYPE_DOT: Record<string, string> = {
	Person: "bg-foreground",
	Knowledge: "bg-muted-foreground",
	Process: "bg-foreground",
	Asset: "bg-muted-foreground",
	Unit: "bg-muted-foreground",
	Risk: "bg-destructive",
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
			<div className="p-10 text-sm text-muted-foreground">
				{error || "Loading…"}
			</div>
		);
	}

	const nodeTypes = [...new Set(data.nodes.map((n) => n.type))];

	return (
		<div className="flex h-screen flex-col bg-background text-foreground">
			<div className="flex items-center justify-between border-b border-border px-8 py-4">
				<div>
					<div className="eyebrow">Living network</div>
					<h1 className="text-xl font-normal">Knowledge Graph</h1>
					<p className="mt-0.5 text-xs text-muted-foreground">
						{data.nodes.length} nodes · {data.edges.length} edges
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{nodeTypes.map((type) => (
						<Badge key={type} variant="secondary" className="gap-1.5">
							<span
								className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[type] ?? "bg-muted-foreground"}`}
							/>
							{type}
						</Badge>
					))}
				</div>
			</div>

			<Card className="m-4 flex-1 overflow-hidden p-0">
				<GraphCanvas service={service} syncVersion={syncVersion} />
			</Card>
		</div>
	);
}
