/**
 * Retrieval pipeline for the RAG Q&A route.
 *
 * `retrieveContexts(companyId, question)`:
 *   1. embed the question (Ollama nomic-embed-text → simpleEmbed fallback)
 *   2. search the pgvector backend scoped to companyId
 *   3. enrich results with nodeName/nodeType via a single nodes lookup
 *   4. filter out any cross-tenant results (defense-in-depth — the SQL path
 *      already filters, but the in-memory fallback path does not, so this
 *      is the actual isolation mechanism for fallback mode)
 *   5. build a content string for each context via the shared buildNodeContent
 */

import { embed } from "@/ai/embeddings";
import { createDb } from "@/db";
import { createPgVectorStore, DEFAULT_TOP_K } from "@/ai/pgvector-store";
import { buildNodeContent } from "@/ai/node-content";
import type { SearchResult } from "@/ai/vector-store";
import type { GraphNode, GraphEdge } from "@/domain/graph";
import type { RetrievedContext } from "./rag-prompt";
import { withTenantTransaction } from "@/db/tenant-transaction";

export type NodeLookup = (
	ids: string[],
	companyId: string,
) => Promise<
	Array<{ id: string; name: string; type: string; company_id: string }>
>;

export type RetrieveOptions = {
	/** Override the nodes lookup (for testing). */
	lookupNodes?: NodeLookup;
	/** Graph snapshot for buildNodeContent (allNodes/allEdges). */
	allNodes?: GraphNode[];
	allEdges?: GraphEdge[];
	/** Override topK (defaults to DEFAULT_TOP_K from RAG_TOP_K). */
	topK?: number;
};

/**
 * Retrieve enriched, tenant-scoped contexts for a question.
 */
export async function retrieveContexts(
	companyId: string,
	question: string,
	opts: RetrieveOptions = {},
): Promise<RetrievedContext[]> {
	const queryVector = await embed(question);
	const db = createDb();
	const store = createPgVectorStore(db);
	const topK = opts.topK ?? DEFAULT_TOP_K;
	const results = await store.search(queryVector, topK, companyId);
	return enrichAndFilter(results, companyId, opts);
}

/**
 * Enrich search results with nodeName/nodeType and filter by tenant.
 * Builds a content string via buildNodeContent when a graph snapshot is
 * provided; otherwise falls back to the metadata from the SQL join.
 */
export async function enrichAndFilter(
	results: SearchResult[],
	companyId: string,
	opts: RetrieveOptions = {},
): Promise<RetrievedContext[]> {
	if (results.length === 0) return [];

	const ids = results.map((r) => r.id);
	const lookup = opts.lookupNodes ?? defaultNodeLookup;
	const nodeRows = await lookup(ids, companyId);
	const byId = new Map(nodeRows.map((r) => [r.id, r]));

	const out: RetrievedContext[] = [];
	for (const r of results) {
		const row = byId.get(r.id);
		// Tenant isolation: drop any result whose company_id doesn't match.
		// This is the actual isolation mechanism for the in-memory fallback
		// path (which has no SQL filter); belt-and-suspenders for the DB path.
		if (!row || row.company_id !== companyId) continue;

		const node = opts.allNodes?.find((n) => n.id === r.id);
		const content = node
			? buildNodeContent(node, opts.allNodes ?? [], opts.allEdges ?? [])
			: ((r.metadata.content as string | undefined) ??
				(r.metadata.nodeName as string | undefined) ??
				r.id);

		out.push({
			nodeId: r.id,
			nodeName: row.name,
			nodeType: row.type,
			relevance: r.score,
			content,
		});
	}
	return out;
}

/**
 * Default nodes lookup: queries the `nodes` table for the given IDs.
 * Kept inline to avoid pulling Drizzle into the test path (tests inject
 * `lookupNodes`).
 */
const defaultNodeLookup: NodeLookup = async (ids, companyId) => {
	if (ids.length === 0) return [];
	const db = createDb();
	const { nodes } = await import("@/db/schema");
	const { eq, inArray } = await import("drizzle-orm");
	const rows = await withTenantTransaction(db, companyId, (tx) => tx
		.select({
			id: nodes.id,
			name: nodes.name,
			type: nodes.type,
			company_id: nodes.companyId,
		})
		.from(nodes)
		.where(inArray(nodes.id, ids)));
	return rows.map((r) => ({ ...r, company_id: r.company_id }));
};
