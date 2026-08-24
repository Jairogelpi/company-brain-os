import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { getGraphService } from "@/server/graph";
import { ingestText } from "@/domain/ingest";
import { getGeminiConfig } from "@/ai/gemini";
import { extractGraphProposals, type ExistingNode } from "@/ai/gemini-extract";
import type { GraphOperationProposal } from "@/domain/interview";
import type { NodeType } from "@/domain/graph";
import { savePending } from "@/server/ingestion";

/**
 * POST /api/graph/build — the AI build assistant.
 *
 * Body: { message: string }. Turns a natural-language description into graph
 * proposals (deterministic interview engine, works without an LLM key) and
 * queues them for human review. AI output never writes canonical truth.
 * Requires contributor+ (graph.node.create).
 */
export async function POST(request: Request) {
	const user = await requireApiUser("graph.node.create");
	if (user instanceof NextResponse) return user;

	let body: { message?: unknown };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const message = typeof body.message === "string" ? body.message.trim() : "";
	if (!message) {
		return NextResponse.json({ error: "message is required" }, { status: 400 });
	}

	const service = getGraphService(user.companyId, user.id);
	const nodes = await service.listNodes();

	// Prefer Gemini extraction (rich: nodes + relationships); fall back to the
	// heuristic ingestText when Gemini is unset or fails.
	let proposals: GraphOperationProposal[] = [];
	let summary = "";
	const cfg = getGeminiConfig();
	if (cfg) {
		try {
			const existing: ExistingNode[] = nodes.map((n) => ({
				id: n.id,
				name: n.name,
				type: n.type as NodeType,
			}));
			const out = await extractGraphProposals(message, existing, cfg);
			proposals = out.proposals;
			summary = out.summary;
		} catch {
			// fall through to heuristic
		}
	}
	if (proposals.length === 0) {
		try {
			const existingNodeIds = new Set(nodes.map((n) => n.id));
			const result = ingestText(message, { source: "ai-build", existingNodeIds });
			proposals = result.proposals.map((p) => p.proposal);
			summary = summary || result.summary;
		} catch (err) {
			return NextResponse.json({ error: (err as Error).message }, { status: 400 });
		}
	}

	if (proposals.length === 0) {
		return NextResponse.json({
			applied: 0,
			summary,
			reply:
				"I couldn't find anything to add. Try naming a person and what they know — e.g. \"Marta knows the billing system and trains Luis on it.\"",
		});
	}

	try {
		const items = await savePending(user.companyId, "ai-build", "text", proposals);
		return NextResponse.json({
			applied: 0,
			queued: items.length,
			summary,
			reply: `Prepared ${items.length} proposal${items.length === 1 ? "" : "s"} for human review in Inbox.`,
		});
	} catch (err) {
		return NextResponse.json({ error: (err as Error).message }, { status: 400 });
	}
}
