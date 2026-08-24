import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { reviewSubmission } from "@/server/missions";
import { getGraphService } from "@/server/graph";
import type { KnowledgeNode } from "@/domain/graph";

/**
 * POST /api/missions/review — the boss approves or rejects a submission.
 * Body: { submissionId, decision: "approve"|"reject", rejectionReason? }.
 *
 * Approve → content evidence is validated and the target knowledge is marked
 * documented. It does not close the mission or remove person-dependency risk;
 * verified transfer is a separate step. Reject → the reason is sent
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

	// Content approval records documentation, not transfer competency. The risk
	// engine deliberately keeps a bus-factor risk open until /missions/verify.
	if (result.approvedTargetNodeId) {
		try {
			const graph = getGraphService(user.companyId, user.id, {
				sourceType: "mission_submission",
				sourceId: result.submission.id,
			});
			const node = await graph.readNode(result.approvedTargetNodeId);
			if (node?.type === "Knowledge") {
				await graph.updateNode(result.approvedTargetNodeId, {
					documented: true,
					validationState: "validated",
				} as Partial<KnowledgeNode>);
			}
		} catch {
			return NextResponse.json(
				{ error: "Review was recorded but the canonical projection is pending retry" },
				{ status: 503 },
			);
		}
	}

	return NextResponse.json({
		submission: result.submission,
		mission: result.mission,
	});
}
