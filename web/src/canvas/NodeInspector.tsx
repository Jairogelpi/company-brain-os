"use client";

import { useEffect, useMemo, useState } from "react";
import {
	canConnect,
	EDGE_TYPES,
	KNOWLEDGE_TYPES,
	type EdgeType,
	type GraphEdge,
	type GraphNode,
	type KnowledgeNode,
} from "@/domain/graph";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const selectClass =
	"h-9 w-full rounded-md border border-border bg-background px-2 text-sm";

export type NodeInspectorProps = {
	node: GraphNode;
	nodes: GraphNode[];
	edges: GraphEdge[];
	canDelete: boolean;
	onClose: () => void;
	/** Re-fetch the graph after any mutation. */
	onChanged: () => void;
};

export default function NodeInspector({
	node,
	nodes,
	edges,
	canDelete,
	onClose,
	onChanged,
}: NodeInspectorProps) {
	const [name, setName] = useState(node.name);
	const [criticality, setCriticality] = useState(node.criticality ?? "");
	const k = node as Partial<KnowledgeNode>;
	const [knowledgeType, setKnowledgeType] = useState(k.knowledgeType ?? "technical");
	const [documented, setDocumented] = useState(Boolean(k.documented));
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	// New-relationship form.
	const [targetId, setTargetId] = useState("");
	const [edgeType, setEdgeType] = useState<EdgeType | "">("");

	useEffect(() => {
		setName(node.name);
		setCriticality(node.criticality ?? "");
		const kn = node as Partial<KnowledgeNode>;
		setKnowledgeType(kn.knowledgeType ?? "technical");
		setDocumented(Boolean(kn.documented));
		setTargetId("");
		setEdgeType("");
		setError("");
	}, [node]);

	const relationships = useMemo(
		() => edges.filter((e) => e.fromNodeId === node.id || e.toNodeId === node.id),
		[edges, node.id],
	);
	const nodeById = useMemo(
		() => new Map(nodes.map((n) => [n.id, n])),
		[nodes],
	);
	const target = targetId ? nodeById.get(targetId) : undefined;
	const validEdgeTypes = useMemo(
		() =>
			target
				? EDGE_TYPES.filter((t) => canConnect(t, node.type, target.type))
				: [],
		[target, node.type],
	);

	async function call(input: RequestInfo, init: RequestInit): Promise<boolean> {
		setBusy(true);
		setError("");
		try {
			const res = await fetch(input, init);
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				setError(body.error || `Request failed (${res.status}).`);
				return false;
			}
			return true;
		} finally {
			setBusy(false);
		}
	}

	async function save() {
		const patch: Record<string, unknown> = { name, criticality };
		if (node.type === "Knowledge") {
			patch.knowledgeType = knowledgeType;
			patch.documented = documented;
		}
		if (await call("/api/graph/node", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: node.id, patch }),
		})) {
			onChanged();
		}
	}

	async function remove() {
		if (!confirm(`Delete "${node.name}" and its relationships?`)) return;
		if (await call(`/api/graph/node?id=${encodeURIComponent(node.id)}`, {
			method: "DELETE",
		})) {
			onClose();
			onChanged();
		}
	}

	async function addEdge() {
		if (!targetId || !edgeType) return;
		if (await call("/api/graph/edge", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ type: edgeType, fromNodeId: node.id, toNodeId: targetId }),
		})) {
			setTargetId("");
			setEdgeType("");
			onChanged();
		}
	}

	async function removeEdge(id: string) {
		if (await call(`/api/graph/edge?id=${encodeURIComponent(id)}`, {
			method: "DELETE",
		})) {
			onChanged();
		}
	}

	return (
		<div className="flex h-full w-80 flex-col border-l border-border bg-background">
			<div className="flex items-center justify-between border-b border-border px-4 py-3">
				<div>
					<div className="eyebrow">{node.type}</div>
					<div className="text-sm font-medium">Inspector</div>
				</div>
				<button
					onClick={onClose}
					className="text-muted-foreground hover:text-foreground"
					aria-label="Close inspector"
				>
					✕
				</button>
			</div>

			<div className="flex-1 space-y-5 overflow-y-auto p-4">
				<div className="space-y-1.5">
					<Label htmlFor="ins-name">Name</Label>
					<Input
						id="ins-name"
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="ins-crit">Criticality</Label>
					<select
						id="ins-crit"
						className={selectClass}
						value={criticality}
						onChange={(e) => setCriticality(e.target.value)}
					>
						<option value="">—</option>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
					</select>
				</div>

				{node.type === "Knowledge" && (
					<>
						<div className="space-y-1.5">
							<Label htmlFor="ins-ktype">Knowledge type</Label>
							<select
								id="ins-ktype"
								className={selectClass}
								value={knowledgeType}
								onChange={(e) => setKnowledgeType(e.target.value as KnowledgeNode["knowledgeType"])}
							>
								{KNOWLEDGE_TYPES.map((t) => (
									<option key={t} value={t}>
										{t}
									</option>
								))}
							</select>
						</div>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={documented}
								onChange={(e) => setDocumented(e.target.checked)}
							/>
							Documented
						</label>
					</>
				)}

				<Button onClick={save} disabled={busy} className="w-full">
					{busy ? "Saving…" : "Save"}
				</Button>

				{/* Relationships */}
				<div className="space-y-2 border-t border-border pt-4">
					<div className="eyebrow">Relationships</div>
					{relationships.length === 0 && (
						<p className="text-xs text-muted-foreground">No relationships yet.</p>
					)}
					{relationships.map((e) => {
						const out = e.fromNodeId === node.id;
						const other = nodeById.get(out ? e.toNodeId : e.fromNodeId);
						return (
							<div
								key={e.id}
								className="flex items-center justify-between gap-2 text-xs"
							>
								<span className="truncate">
									{out ? "→" : "←"} <span className="font-medium">{e.type}</span>{" "}
									{other?.name ?? "?"}
								</span>
								<button
									onClick={() => removeEdge(e.id)}
									disabled={busy}
									className="text-muted-foreground hover:text-destructive"
									aria-label="Remove relationship"
								>
									✕
								</button>
							</div>
						);
					})}

					<div className="space-y-2 pt-2">
						<select
							className={selectClass}
							value={targetId}
							onChange={(e) => {
								setTargetId(e.target.value);
								setEdgeType("");
							}}
						>
							<option value="">Connect to…</option>
							{nodes
								.filter((n) => n.id !== node.id)
								.map((n) => (
									<option key={n.id} value={n.id}>
										{n.name} ({n.type})
									</option>
								))}
						</select>
						{target && (
							<select
								className={selectClass}
								value={edgeType}
								onChange={(e) => setEdgeType(e.target.value as EdgeType)}
							>
								<option value="">Relationship…</option>
								{validEdgeTypes.map((t) => (
									<option key={t} value={t}>
										{t}
									</option>
								))}
							</select>
						)}
						{target && validEdgeTypes.length === 0 && (
							<p className="text-xs text-muted-foreground">
								No valid relationship between {node.type} and {target.type}.
							</p>
						)}
						<Button
							variant="outline"
							onClick={addEdge}
							disabled={busy || !targetId || !edgeType}
							className="w-full"
						>
							Add relationship
						</Button>
					</div>
				</div>

				{error && <p className="text-xs font-medium text-destructive">{error}</p>}

				{/* Danger zone */}
				<div className="border-t border-border pt-4">
					<Button
						variant="ghost"
						onClick={remove}
						disabled={busy || !canDelete}
						className="w-full text-destructive hover:text-destructive"
					>
						Delete node
					</Button>
					{!canDelete && (
						<p className="mt-1 text-center text-[11px] text-muted-foreground">
							Requires validator role.
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
