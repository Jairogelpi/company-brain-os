import type { GraphEdge, GraphNode } from "./graph";
import { computeBusFactors, computeDependencies } from "./metrics";

// --- Transfer Velocity ---

/**
 * Transfer Velocity: rate of level increase in LEARNS edges (Δlevel / months).
 * Measures how fast someone is learning.
 */
export function computeTransferVelocity(
	before: { level: number; timestamp: string },
	after: { level: number; timestamp: string },
): number {
	const deltaLevel = after.level - before.level;
	const beforeDate = new Date(before.timestamp);
	const afterDate = new Date(after.timestamp);
	const monthsDiff =
		(afterDate.getTime() - beforeDate.getTime()) / (30 * 24 * 3600000);

	if (monthsDiff <= 0) return 0;
	return Math.round((deltaLevel / monthsDiff) * 100) / 100;
}

// --- Timeline ---

export interface TimelineEvent {
	type: string;
	actorId?: string;
	timestamp: string;
	description: string;
}

export interface NodeTimeline {
	nodeId: string;
	nodeName: string;
	events: TimelineEvent[];
}

export function buildNodeTimeline(
	nodeId: string,
	nodeName: string,
	events: Array<{
		eventType: string;
		actorId?: string;
		createdAt: string;
		payload: Record<string, unknown>;
	}>,
): NodeTimeline {
	const filtered = events
		.filter((e) => {
			const p = e.payload;
			return (
				p.nodeId === nodeId || (p as { edgeId?: string }).edgeId === nodeId
			);
		})
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

	return {
		nodeId,
		nodeName,
		events: filtered.map((e) => ({
			type: e.eventType,
			actorId: e.actorId,
			timestamp: e.createdAt,
			description: buildEventDescription(e.eventType, e.payload),
		})),
	};
}

function buildEventDescription(
	eventType: string,
	payload: Record<string, unknown>,
): string {
	const actor = (payload.actorId as string) ?? "system";
	switch (eventType) {
		case "graph.node.created":
			return `Created by ${actor}`;
		case "graph.node.updated":
			return `Updated by ${actor}`;
		case "graph.node.deleted":
			return `Deleted (${(payload.cascadedEdgeIds as string[])?.length ?? 0} edges cascaded)`;
		case "graph.edge.created":
			return `Edge created: ${payload.edgeId}`;
		case "graph.edge.deleted":
			return `Edge deleted`;
		default:
			return eventType;
	}
}

// --- Deep Simulator ---

export interface DeepSimImpact {
	nodeId: string;
	nodeName: string;
	nodeType: string;
	impact: "blocked" | "degraded" | "affected" | "unchanged";
	path: string[]; // chain of dependencies
}

export interface DeepSimReport {
	removedNodeId: string;
	removedNodeName: string;
	directImpacts: DeepSimImpact[];
	indirectImpacts: DeepSimImpact[];
	summary: {
		totalBlocked: number;
		totalDegraded: number;
		totalAffected: number;
		message: string;
	};
}

/**
 * Deep simulation: traverse DEPENDS_ON, REQUIRES, EXECUTES, PRODUCES chains.
 * When a node is removed, find everything transitively affected.
 */
export function simulateDeepImpact(
	nodes: GraphNode[],
	edges: GraphEdge[],
	removedNodeId: string,
): DeepSimReport {
	const removed = nodes.find((n) => n.id === removedNodeId);
	const removedName = removed?.name ?? removedNodeId;

	// Build adjacency for traversal
	const outgoing = new Map<string, GraphEdge[]>();
	for (const e of edges) {
		if (!outgoing.has(e.fromNodeId)) outgoing.set(e.fromNodeId, []);
		outgoing.get(e.fromNodeId)!.push(e);
	}

	// BFS from removed node following DEPENDS_ON, REQUIRES, EXECUTES, PRODUCES
	const visited = new Set<string>();
	const queue: Array<{ nodeId: string; path: string[] }> = [
		{ nodeId: removedNodeId, path: [removedNodeId] },
	];
	const impacts: DeepSimImpact[] = [];

	while (queue.length > 0) {
		const current = queue.shift()!;
		if (visited.has(current.nodeId)) continue;
		visited.add(current.nodeId);

		const currentEdges = outgoing.get(current.nodeId) ?? [];
		for (const e of currentEdges) {
			const targetNode = nodes.find((n) => n.id === e.toNodeId);
			const newPath = [...current.path, e.toNodeId];

			let impact: DeepSimImpact["impact"];
			if (e.type === "REQUIRES" || e.type === "DEPENDS_ON") {
				impact = current.nodeId === removedNodeId ? "blocked" : "degraded";
			} else if (e.type === "EXECUTES" || e.type === "PRODUCES") {
				impact = "affected";
			} else {
				impact = "unchanged";
			}

			if (impact !== "unchanged") {
				impacts.push({
					nodeId: e.toNodeId,
					nodeName: targetNode?.name ?? e.toNodeId,
					nodeType: targetNode?.type ?? "unknown",
					impact,
					path: newPath,
				});
			}

			// Continue traversal for structural edges
			if (
				e.type === "DEPENDS_ON" ||
				e.type === "REQUIRES" ||
				e.type === "EXECUTES" ||
				e.type === "PRODUCES"
			) {
				queue.push({ nodeId: e.toNodeId, path: newPath });
			}
		}
	}

	const direct = impacts.filter((i) => i.path.length === 2);
	const indirect = impacts.filter((i) => i.path.length > 2);
	const blocked = impacts.filter((i) => i.impact === "blocked").length;
	const degraded = impacts.filter((i) => i.impact === "degraded").length;
	const affected = impacts.filter((i) => i.impact === "affected").length;

	let message: string;
	if (blocked > 0) {
		message = `🚨 Removing "${removedName}" blocks ${blocked} node(s), degrades ${degraded}, affects ${affected}.`;
	} else if (degraded > 0) {
		message = `⚠️ Removing "${removedName}" degrades ${degraded} node(s), affects ${affected}.`;
	} else {
		message = `✅ Removing "${removedName}" has no structural impact.`;
	}

	return {
		removedNodeId,
		removedNodeName: removedName,
		directImpacts: direct,
		indirectImpacts: indirect,
		summary: {
			totalBlocked: blocked,
			totalDegraded: degraded,
			totalAffected: affected,
			message,
		},
	};
}

// --- Auto-diagram generator ---

export function generateMermaidDiagram(
	nodes: GraphNode[],
	edges: GraphEdge[],
	centerNodeId?: string,
): string {
	const lines: string[] = ["graph TD"];

	const nodeLabel = (n: GraphNode) => `${n.type}: ${n.name}`.replace(/"/g, "'");

	// If center node specified, only show its neighborhood
	const relevantEdges = centerNodeId
		? edges.filter(
				(e) => e.fromNodeId === centerNodeId || e.toNodeId === centerNodeId,
			)
		: edges;

	const relevantNodeIds = new Set<string>();
	for (const e of relevantEdges) {
		relevantNodeIds.add(e.fromNodeId);
		relevantNodeIds.add(e.toNodeId);
	}
	if (centerNodeId) relevantNodeIds.add(centerNodeId);

	const relevantNodes = nodes.filter((n) => relevantNodeIds.has(n.id));

	const typeIcons: Record<string, string> = {
		Person: "👤",
		Knowledge: "📚",
		Process: "⚙️",
		Asset: "🏭",
		Unit: "🏢",
		Risk: "⚠️",
	};

	for (const node of relevantNodes) {
		const icon = typeIcons[node.type] ?? "";
		const safeId = node.id.replace(/[^a-zA-Z0-9]/g, "_");
		lines.push(`  ${safeId}[${icon} ${nodeLabel(node)}]`);
	}

	for (const edge of relevantEdges) {
		const from = edge.fromNodeId.replace(/[^a-zA-Z0-9]/g, "_");
		const to = edge.toNodeId.replace(/[^a-zA-Z0-9]/g, "_");
		const label = edge.type;
		const level = edge.attributes?.level;
		const edgeLabel = level ? `${label} L${level}` : label;
		lines.push(`  ${from} -->|${edgeLabel}| ${to}`);
	}

	return lines.join("\n");
}
