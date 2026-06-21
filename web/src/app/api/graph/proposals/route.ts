import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { getGraphService } from "@/server/graph";
import type { GraphOperationProposal } from "@/domain/interview";
import type { GraphConfirmationDecision } from "@/domain/graph-confirmation";

/**
 * POST /api/graph/proposals — persist interview proposals to the company graph.
 * Body: { proposals, decisions }. Requires contributor+ (graph.node.create).
 */
export async function POST(request: Request) {
	const user = await requireApiUser("graph.node.create");
	if (user instanceof NextResponse) return user;

	let body: {
		proposals?: GraphOperationProposal[];
		decisions?: GraphConfirmationDecision[];
	};
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const proposals = body.proposals ?? [];
	const decisions = body.decisions ?? [];
	if (!Array.isArray(proposals) || !Array.isArray(decisions)) {
		return NextResponse.json(
			{ error: "proposals and decisions must be arrays" },
			{ status: 400 },
		);
	}

	const service = getGraphService(user.companyId, user.id);
	try {
		// The persistent service validates the resulting graph; a bad payload
		// throws and is surfaced as a 400 rather than corrupting state.
		const events = await service.applyProposalsWithDecisions(
			proposals,
			decisions,
		);
		const nodeCount = (await service.listNodes()).length;
		return NextResponse.json({ applied: events.length, nodeCount });
	} catch (err) {
		return NextResponse.json(
			{ error: (err as Error).message },
			{ status: 400 },
		);
	}
}
