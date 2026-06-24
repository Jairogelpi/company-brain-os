import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { getGraphService } from "@/server/graph";
import { savePending } from "@/server/ingestion";
import { ingestText } from "@/domain/ingest";
import { getGeminiConfig } from "@/ai/gemini";
import { extractGraphProposals, type ExistingNode } from "@/ai/gemini-extract";
import type { GraphOperationProposal } from "@/domain/interview";
import type { NodeType } from "@/domain/graph";

/**
 * POST /api/interview/extract — turn captured text into graph proposals and
 * queue them for review (NOT applied directly).
 *
 * Uses Gemini when configured (rich: people, knowledge, processes, clients,
 * suppliers, systems, projects + relationships), falling back to the heuristic
 * ingestText otherwise. Proposals land in the /inbox review queue, so a human
 * approves before anything is written to the graph. Requires contributor+.
 *
 * Body: { text: string }.
 */
export async function POST(request: Request) {
	const user = await requireApiUser("graph.node.create");
	if (user instanceof NextResponse) return user;

	let body: { text?: unknown };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	const text = typeof body.text === "string" ? body.text.trim() : "";
	if (!text) {
		return NextResponse.json({ error: "text is required" }, { status: 400 });
	}

	const service = getGraphService(user.companyId, user.id);
	const nodes = await service.listNodes();

	let proposals: GraphOperationProposal[] = [];
	let summary = "";
	let usedAi = false;

	const cfg = getGeminiConfig();
	if (cfg) {
		try {
			const existing: ExistingNode[] = nodes.map((n) => ({
				id: n.id,
				name: n.name,
				type: n.type as NodeType,
			}));
			const out = await extractGraphProposals(text, existing, cfg);
			proposals = out.proposals;
			summary = out.summary;
			usedAi = true;
		} catch {
			// fall back to heuristic below
		}
	}

	if (!usedAi || proposals.length === 0) {
		const existingNodeIds = new Set(nodes.map((n) => n.id));
		const result = ingestText(text, { source: "capture", existingNodeIds });
		proposals = result.proposals.map((p) => p.proposal);
		summary = usedAi ? summary : result.summary;
	}

	if (proposals.length === 0) {
		return NextResponse.json({ queued: 0, summary: summary || "No se extrajo nada." });
	}

	const items = await savePending(user.companyId, "ai-capture", "text", proposals);
	return NextResponse.json({ queued: items.length, summary, usedAi });
}
