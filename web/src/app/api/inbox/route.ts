import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { getGraphService } from "@/server/graph";
import {
	listPending,
	getPendingByIds,
	markReviewed,
} from "@/server/ingestion";

/** GET /api/inbox — pending review items + count, for the current company. */
export async function GET() {
	const user = await requireApiUser();
	if (user instanceof NextResponse) return user;
	const items = await listPending(user.companyId);
	return NextResponse.json({ items, count: items.length });
}

/**
 * POST /api/inbox — review pending items.
 * Body: { action: "approve" | "reject", ids: string[] }.
 * Approve persists the proposals via the graph write-path. Requires contributor+.
 */
export async function POST(request: Request) {
	const user = await requireApiUser("graph.node.create");
	if (user instanceof NextResponse) return user;

	let body: { action?: "approve" | "reject"; ids?: string[] };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	const ids = Array.isArray(body.ids) ? body.ids : [];
	if (ids.length === 0) {
		return NextResponse.json({ error: "No ids provided" }, { status: 400 });
	}

	if (body.action === "reject") {
		await markReviewed(user.companyId, ids, "rejected");
		return NextResponse.json({ rejected: ids.length });
	}

	if (body.action === "approve") {
		const pending = await getPendingByIds(user.companyId, ids);
		const proposals = pending.map((p) => p.proposal);
		const decisions = proposals.map((_, i) => ({
			proposalIndex: i,
			decision: "approve" as const,
		}));
		const service = getGraphService(user.companyId, user.id, {
			sourceType: "ingestion_review",
			sourceId: pending.map((item) => item.id).sort().join(","),
		});
		try {
			const events = await service.applyProposalsWithDecisions(
				proposals,
				decisions,
			);
			await markReviewed(
				user.companyId,
				pending.map((p) => p.id),
				"approved",
			);
			return NextResponse.json({ applied: events.length });
		} catch (err) {
			return NextResponse.json(
				{ error: (err as Error).message },
				{ status: 400 },
			);
		}
	}

	return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
