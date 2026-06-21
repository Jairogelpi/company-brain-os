import { createGraphService, type GraphService } from "./graph-service";
import type { GraphEdge, GraphNode } from "./graph";

/**
 * Builds a synchronous in-memory GraphService from DB-loaded nodes/edges,
 * for the tldraw canvas which needs the sync API. Edits stay client-side.
 */
export function hydrateGraphService(
	nodes: GraphNode[],
	edges: GraphEdge[],
	companyId = "demo-corp",
): GraphService {
	const service = createGraphService({ actorId: "viewer", companyId });
	// ponytail: swallow per-item errors — DB data is already validated, and one
	// bad row shouldn't blank the whole canvas.
	for (const n of nodes) {
		try {
			service.createNode(n);
		} catch {}
	}
	for (const e of edges) {
		try {
			service.createEdge(e);
		} catch {}
	}
	return service;
}
