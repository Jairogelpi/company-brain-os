import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import {
	closeVerifiedMission,
	reviewTransferVerification,
	submitTransferVerification,
} from "@/server/missions";
import { getGraphService } from "@/server/graph";
import { listCompanyUsers } from "@/server/users";

type Body = {
	action?: "submit" | "review";
	missionId?: string;
	verificationId?: string;
	backupPersonId?: string;
	competencyLevel?: number;
	accessVerified?: boolean;
	evidenceRefs?: string[];
	decision?: "approve" | "reject";
	rejectionReason?: string;
};

/** Submit or independently review evidence that knowledge transfer is real. */
export async function POST(request: Request) {
	let body: Body;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	if (body.action === "submit") {
		const user = await requireApiUser("graph.node.create");
		if (user instanceof NextResponse) return user;
		if (!body.missionId || !body.backupPersonId || !Number.isInteger(body.competencyLevel) || !Array.isArray(body.evidenceRefs)) {
			return NextResponse.json({ error: "missionId, backupPersonId, competencyLevel and evidenceRefs are required" }, { status: 400 });
		}
		try {
			const graph = getGraphService(user.companyId);
			const [backup, companyUsers] = await Promise.all([
				graph.readNode(body.backupPersonId),
				listCompanyUsers(user.companyId),
			]);
			if (backup?.type !== "Person") {
				return NextResponse.json({ error: "backupPersonId must reference a mapped Person" }, { status: 400 });
			}
			const assessorPersonId = companyUsers.find((member) => member.id === user.id)?.personNodeId;
			if (!assessorPersonId || (await graph.readNode(assessorPersonId))?.type !== "Person") {
				return NextResponse.json({ error: "Map your user account to a canonical Person before assessing a transfer." }, { status: 422 });
			}
			if (assessorPersonId === body.backupPersonId) {
				return NextResponse.json({ error: "A backup cannot assess their own transfer" }, { status: 400 });
			}
			const verification = await submitTransferVerification(user.companyId, {
				missionId: body.missionId,
				backupPersonId: body.backupPersonId,
				assessorId: user.id,
				assessorPersonId,
				competencyLevel: body.competencyLevel!,
				accessVerified: body.accessVerified === true,
				evidenceRefs: body.evidenceRefs,
			});
			return NextResponse.json({ verification });
		} catch (error) {
			return NextResponse.json({ error: (error as Error).message }, { status: 400 });
		}
	}

	if (body.action === "review") {
		const user = await requireApiUser("mission.close");
		if (user instanceof NextResponse) return user;
		if (!body.verificationId || (body.decision !== "approve" && body.decision !== "reject")) {
			return NextResponse.json({ error: "verificationId and decision are required" }, { status: 400 });
		}
		try {
			const reviewerPersonId = (await listCompanyUsers(user.companyId)).find(
				(member) => member.id === user.id,
			)?.personNodeId;
			if (!reviewerPersonId || (await getGraphService(user.companyId).readNode(reviewerPersonId))?.type !== "Person") {
				return NextResponse.json({ error: "Map your user account to a canonical Person before reviewing a transfer." }, { status: 422 });
			}
			const result = await reviewTransferVerification(user.companyId, {
				verificationId: body.verificationId,
				reviewerId: user.id,
				reviewerPersonId,
				decision: body.decision,
				rejectionReason: body.rejectionReason,
			});
			if (result.verification.status !== "approved") return NextResponse.json(result);

			try {
				const graph = getGraphService(user.companyId, user.id, {
					sourceType: "transfer_verification",
					sourceId: result.verification.id,
				});
				const edgeId = `transfer-${result.verification.id}`;
				const existing = (await graph.listEdges()).find((edge) => edge.id === edgeId);
				if (existing && (existing.fromNodeId !== result.verification.backupPersonId || existing.toNodeId !== result.verification.targetNodeId || existing.type !== "MASTERS")) {
					throw new Error("Transfer evidence edge ID conflicts with a different relationship");
				}
				if (!existing) {
					await graph.createEdge({
						id: edgeId,
						type: "MASTERS",
						fromNodeId: result.verification.backupPersonId,
						toNodeId: result.verification.targetNodeId,
						attributes: {
							level: result.verification.competencyLevel,
							accessVerified: true,
							transferVerificationId: result.verification.id,
							evidenceRefs: result.verification.evidenceRefs,
						},
					});
				}
				const mission = await closeVerifiedMission(
					user.companyId,
					result.mission.id,
					result.verification.id,
				);
				return NextResponse.json({ verification: result.verification, mission });
			} catch (error) {
				return NextResponse.json({
					error: `Review recorded; canonical projection or mission closure is pending an idempotent retry: ${(error as Error).message}`,
				}, { status: 503 });
			}
		} catch (error) {
			return NextResponse.json({ error: (error as Error).message }, { status: 400 });
		}
	}

	return NextResponse.json({ error: "action must be submit or review" }, { status: 400 });
}
