import type { GraphNode, GraphEdge, KnowledgeNode } from "@/domain/graph";

/**
 * Build a content string for a graph node used by both the in-memory
 * `OrganizationMemory` index and the RAG retrieval pipeline
 * (`retrieve.ts`). Extracted from `organization-memory.ts` (byte-identical
 * move) so the RAG prompt and the in-memory search share one builder and
 * cannot drift.
 *
 * Format: `name. type. bus factor N. confianza M%. documentado. <edges>. <knowledge extras>`
 */
export function buildNodeContent(
	node: GraphNode,
	nodes: GraphNode[],
	edges: GraphEdge[],
	busFactor?: number,
	confidence?: number,
	documented?: boolean,
): string {
	const parts: string[] = [node.name, node.type];

	if (busFactor !== undefined) parts.push(`bus factor ${busFactor}`);
	if (confidence !== undefined) parts.push(`confianza ${confidence}%`);
	if (documented !== undefined) {
		parts.push(documented ? "documentado" : "no documentado");
	}

	const relatedEdges = edges.filter(
		(e) => e.fromNodeId === node.id || e.toNodeId === node.id,
	);
	for (const e of relatedEdges) {
		const otherId = e.fromNodeId === node.id ? e.toNodeId : e.fromNodeId;
		const other = nodes.find((n) => n.id === otherId);
		if (other) parts.push(`${e.type} ${other.name}`);
	}

	if (node.type === "Knowledge") {
		const k = node as KnowledgeNode;
		if (k.knowledgeType) parts.push(k.knowledgeType);
		if (k.validationState) parts.push(k.validationState);
	}

	return parts.join(". ");
}
