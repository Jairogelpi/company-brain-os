import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { reviewSubmission } from "@/server/missions";
import { getGraphService } from "@/server/graph";
import type { KnowledgeNode } from "@/domain/graph";

/**
 * POST /api/missions/review — the boss approves or rejects a submission.
 * Body: { submissionId, decision: "approve"|"reject", rejectionReason? }.
 *
 * Approve → mission closed and the target knowledge node is marked documented +
 * validated (which lowers its bus-factor risk). Reject → the reason is sent
 * back to the employee and the mission returns to in_progress.
 * Requires mission.close (validator+).
 */
export async function POST(request: Request) {
	const user = await requireApiUser("mission.close");
	if (user instanceof NextResponse) return user;

	let body: {
		submissionId?: string;
		decision?: "approve" | "reject";
		rejectionReason?: string;
	};
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	if (!body.submissionId || (body.decision !== "approve" && body.decision !== "reject")) {
		return NextResponse.json(
			{ error: "submissionId and decision (approve|reject) required" },
			{ status: 400 },
		);
	}
	if (body.decision === "reject" && !(body.rejectionReason ?? "").trim()) {
		return NextResponse.json(
			{ error: "A rejection reason is required." },
			{ status: 400 },
		);
	}

	let result;
	try {
		result = await reviewSubmission(user.companyId, {
			submissionId: body.submissionId,
			reviewerId: user.id,
			decision: body.decision,
			rejectionReason: body.rejectionReason,
		});
	} catch (err) {
		return NextResponse.json({ error: (err as Error).message }, { status: 400 });
	}

	// On approval, close the knowledge loop: mark the target node documented +
	// validated so the risk engine stops flagging it. Best-effort — a non-
	// knowledge target (or a missing node) must not fail the review.
	if (result.approvedTargetNodeId) {
		try {
			const graph = getGraphService(user.companyId, user.id);
			const node = await graph.readNode(result.approvedTargetNodeId);
			if (node?.type === "Knowledge") {
				await graph.updateNode(result.approvedTargetNodeId, {
					documented: true,
					validationState: "validated",
				} as Partial<KnowledgeNode>);
			}
		} catch {
			// ignore — review already succeeded
		}
	}

	return NextResponse.json({
		submission: result.submission,
		mission: result.mission,
	});
}
