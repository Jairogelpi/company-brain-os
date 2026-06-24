"use client";

import { useMemo, useState } from "react";
import InteractiveGraph from "@/canvas/InteractiveGraph";
import NodeInspector from "@/canvas/NodeInspector";
import GraphBuildChat from "@/canvas/GraphBuildChat";
import { useGraph } from "@/components/useGraph";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { NODE_TYPES, type NodeType } from "@/domain/graph";

const TYPE_DOT: Record<NodeType, string> = {
	Person: "bg-foreground",
	Knowledge: "bg-[var(--color-highlighter-yellow)]",
	Process: "bg-emerald-400",
	Asset: "bg-slate-400",
	Unit: "bg-blue-400",
	Risk: "bg-destructive",
	Client: "bg-teal-400",
	Supplier: "bg-orange-400",
	Project: "bg-violet-400",
	System: "bg-sky-400",
};

export default function GraphPage() {
	const { data, error, reload } = useGraph();
	const { can } = useAuth();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const [newType, setNewType] = useState<NodeType>("Person");
	const [newName, setNewName] = useState("");

	const selected = useMemo(
		() => data?.nodes.find((n) => n.id === selectedId) ?? null,
		[data, selectedId],
	);

	if (!data) {
		return (
			<div className="p-10 text-sm text-muted-foreground">
				{error || "Loading…"}
			</div>
		);
	}

	async function moveNode(id: string, pos: { x: number; y: number }) {
		await fetch("/api/graph/node", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id, position: pos }),
		});
	}

	async function addNode() {
		const name = newName.trim();
		if (!name) return;
		const res = await fetch("/api/graph/node", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ type: newType, name }),
		});
		if (res.ok) {
			setNewName("");
			setAdding(false);
			reload();
		}
	}

	const canAdd = can("graph.node.create");

	return (
		<div className="flex h-screen flex-col bg-background text-foreground">
			<div className="flex items-center justify-between gap-4 border-b border-border px-6 py-3">
				<div>
					<div className="eyebrow">Living network</div>
					<h1 className="text-lg font-normal">Knowledge Graph</h1>
					<p className="text-xs text-muted-foreground">
						{data.nodes.length} nodes · {data.edges.length} edges · drag to
						arrange, click to edit
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{NODE_TYPES.map((type) => (
						<span
							key={type}
							className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
						>
							<span className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[type]}`} />
							{type}
						</span>
					))}
				</div>

				{canAdd &&
					(adding ? (
						<div className="flex items-center gap-2">
							<select
								className="h-9 rounded-md border border-border bg-background px-2 text-sm"
								value={newType}
								onChange={(e) => setNewType(e.target.value as NodeType)}
							>
								{NODE_TYPES.map((t) => (
									<option key={t} value={t}>
										{t}
									</option>
								))}
							</select>
							<input
								autoFocus
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && addNode()}
								placeholder="Name…"
								className="h-9 w-36 rounded-md border border-border bg-background px-2 text-sm"
							/>
							<Button size="sm" onClick={addNode} disabled={!newName.trim()}>
								Add
							</Button>
							<Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
								Cancel
							</Button>
						</div>
					) : (
						<Button size="sm" onClick={() => setAdding(true)}>
							+ Add node
						</Button>
					))}
			</div>

			<div className="flex min-h-0 flex-1">
				<div className="min-w-0 flex-1">
					<InteractiveGraph
						nodes={data.nodes}
						edges={data.edges}
						selectedId={selectedId}
						onSelect={setSelectedId}
						onMoveNode={moveNode}
					/>
				</div>

				{selected ? (
					<NodeInspector
						node={selected}
						nodes={data.nodes}
						edges={data.edges}
						canDelete={can("graph.node.delete")}
						onClose={() => setSelectedId(null)}
						onChanged={reload}
					/>
				) : (
					<GraphBuildChat onBuilt={reload} />
				)}
			</div>
		</div>
	);
}
