import { and, eq } from "drizzle-orm";
import { createDb } from "@/db";
import { missions, missionSubmissions } from "@/db/schema";
import {
	VALID_TRANSITIONS,
	type Mission,
	type MissionStatus,
	type MissionSubmission,
} from "@/domain/missions";

/** DB-backed missions, scoped to a company (tenant). */

type Row = typeof missions.$inferSelect;
type SubRow = typeof missionSubmissions.$inferSelect;

export function rowToMission(r: Row): Mission {
	return {
		id: r.id,
		objective: r.objective,
		targetNodeId: r.targetNodeId,
		targetNodeName: r.targetNodeName,
		assigneeIds: r.assigneeIds,
		assigneeId: r.assigneeId ?? undefined,
		instructions: r.instructions ?? undefined,
		rejectionReason: r.rejectionReason ?? undefined,
		priority: r.priority,
		dueDate: r.dueDate ?? undefined,
		status: r.status,
		createdBy: r.createdBy,
		createdAt: r.createdAt.toISOString(),
		closedAt: r.closedAt?.toISOString(),
		detailedSteps: r.detailedSteps ?? undefined,
		suggestedTrainerId: r.suggestedTrainerId ?? undefined,
		suggestedTrainerName: r.suggestedTrainerName ?? undefined,
		rationale: r.rationale ?? undefined,
		riskNote: r.riskNote ?? undefined,
	};
}

function rowToSubmission(r: SubRow): MissionSubmission {
	return {
		id: r.id,
		missionId: r.missionId,
		authorId: r.authorId,
		kind: r.kind,
		text: r.text ?? undefined,
		storageUrl: r.storageUrl ?? undefined,
		fileName: r.fileName ?? undefined,
		mimeType: r.mimeType ?? undefined,
		mediaType: r.mediaType ?? undefined,
		status: r.status,
		reviewerId: r.reviewerId ?? undefined,
		rejectionReason: r.rejectionReason ?? undefined,
		createdAt: r.createdAt.toISOString(),
		reviewedAt: r.reviewedAt?.toISOString(),
	};
}

export async function saveMissions(
	companyId: string,
	personId: string | undefined,
	rows: Array<{
		id: string;
		objective: string;
		targetNodeId: string;
		targetNodeName: string;
		priority: "low" | "medium" | "high" | "critical";
		dueDate?: string;
		createdBy: string;
		detailedSteps?: string[];
		suggestedTrainerId?: string;
		suggestedTrainerName?: string;
		rationale?: string;
		riskNote?: string;
	}>,
): Promise<number> {
	if (rows.length === 0) return 0;
	await createDb()
		.insert(missions)
		.values(
			rows.map((r) => ({ ...r, companyId, personId, status: "open" as const })),
		);
	return rows.length;
}

export async function listMissions(companyId: string): Promise<Mission[]> {
	const rows = await createDb()
		.select()
		.from(missions)
		.where(eq(missions.companyId, companyId))
		.orderBy(missions.createdAt);
	return rows.map(rowToMission);
}

export async function readMission(
	companyId: string,
	id: string,
): Promise<Mission | undefined> {
	const rows = await createDb()
		.select()
		.from(missions)
		.where(and(eq(missions.companyId, companyId), eq(missions.id, id)))
		.limit(1);
	return rows[0] ? rowToMission(rows[0]) : undefined;
}

async function getMission(
	db: ReturnType<typeof createDb>,
	companyId: string,
	id: string,
): Promise<Row> {
	const rows = await db
		.select()
		.from(missions)
		.where(and(eq(missions.companyId, companyId), eq(missions.id, id)))
		.limit(1);
	if (!rows[0]) throw new Error(`Mission not found: ${id}`);
	return rows[0];
}

/** Assign a mission to an employee and/or set its detailed instructions. */
export async function assignMission(
	companyId: string,
	id: string,
	patch: { assigneeId?: string; instructions?: string },
): Promise<Mission> {
	const db = createDb();
	const current = await getMission(db, companyId, id);
	await db
		.update(missions)
		.set({
			assigneeId: patch.assigneeId ?? current.assigneeId,
			instructions: patch.instructions ?? current.instructions,
		})
		.where(and(eq(missions.companyId, companyId), eq(missions.id, id)));
	return rowToMission({
		...current,
		assigneeId: patch.assigneeId ?? current.assigneeId,
		instructions: patch.instructions ?? current.instructions,
	});
}

/** Transition a mission, enforcing the domain's allowed transitions + tenancy. */
export async function transitionMissionStatus(
	companyId: string,
	id: string,
	to: MissionStatus,
): Promise<Mission> {
	const db = createDb();
	const current = await getMission(db, companyId, id);
	if (!VALID_TRANSITIONS[current.status].includes(to)) {
		throw new Error(
			`Invalid transition ${current.status} → ${to}. Valid: ${
				VALID_TRANSITIONS[current.status].join(", ") || "none"
			}`,
		);
	}
	await db
		.update(missions)
		.set({
			status: to,
			closedAt: to === "closed" ? new Date() : current.closedAt,
		})
		.where(and(eq(missions.companyId, companyId), eq(missions.id, id)));
	return rowToMission({ ...current, status: to });
}

// --- Submissions ---

export async function listSubmissions(
	companyId: string,
): Promise<MissionSubmission[]> {
	const rows = await createDb()
		.select()
		.from(missionSubmissions)
		.where(eq(missionSubmissions.companyId, companyId))
		.orderBy(missionSubmissions.createdAt);
	return rows.map(rowToSubmission);
}

/**
 * Employee submits a deliverable. Moves the mission to "submitted" (from open
 * or in_progress) and clears any prior rejection reason.
 */
export async function createSubmission(
	companyId: string,
	input: {
		missionId: string;
		authorId: string;
		kind: "file" | "text";
		text?: string;
		storageUrl?: string;
		fileName?: string;
		mimeType?: string;
		mediaType?: string;
	},
): Promise<MissionSubmission> {
	const db = createDb();
	const mission = await getMission(db, companyId, input.missionId);

	const id = `sub-${globalThis.crypto.randomUUID()}`;
	const [row] = await db
		.insert(missionSubmissions)
		.values({ ...input, id, companyId, status: "pending" })
		.returning();

	// open|in_progress → submitted (re-submission after a rejection re-enters
	// the review queue).
	const next = mission.status === "open" ? "in_progress" : mission.status;
	await db
		.update(missions)
		.set({ status: "submitted", rejectionReason: null })
		.where(
			and(eq(missions.companyId, companyId), eq(missions.id, input.missionId)),
		);
	void next;
	return rowToSubmission(row);
}

export type ReviewResult = {
	submission: MissionSubmission;
	mission: Mission;
	/** Set when an approval should mark the target knowledge node documented. */
	approvedTargetNodeId?: string;
};

/**
 * Boss reviews a submission. Approve → submission approved, mission validated
 * then closed, and the target node should be marked documented. Reject →
 * submission rejected with a reason, mission back to in_progress, reason saved
 * on the mission so the employee sees why.
 */
export async function reviewSubmission(
	companyId: string,
	input: {
		submissionId: string;
		reviewerId: string;
		decision: "approve" | "reject";
		rejectionReason?: string;
	},
): Promise<ReviewResult> {
	const db = createDb();
	const subRows = await db
		.select()
		.from(missionSubmissions)
		.where(
			and(
				eq(missionSubmissions.companyId, companyId),
				eq(missionSubmissions.id, input.submissionId),
			),
		)
		.limit(1);
	const sub = subRows[0];
	if (!sub) throw new Error(`Submission not found: ${input.submissionId}`);
	const mission = await getMission(db, companyId, sub.missionId);

	const now = new Date();
	if (input.decision === "approve") {
		await db
			.update(missionSubmissions)
			.set({ status: "approved", reviewerId: input.reviewerId, reviewedAt: now })
			.where(eq(missionSubmissions.id, sub.id));
		await db
			.update(missions)
			.set({ status: "closed", closedAt: now, rejectionReason: null })
			.where(and(eq(missions.companyId, companyId), eq(missions.id, mission.id)));
		return {
			submission: rowToSubmission({
				...sub,
				status: "approved",
				reviewedAt: now,
			}),
			mission: rowToMission({ ...mission, status: "closed", closedAt: now }),
			approvedTargetNodeId: mission.targetNodeId,
		};
	}

	const reason = (input.rejectionReason ?? "").trim() || "No reason given.";
	await db
		.update(missionSubmissions)
		.set({
			status: "rejected",
			reviewerId: input.reviewerId,
			rejectionReason: reason,
			reviewedAt: now,
		})
		.where(eq(missionSubmissions.id, sub.id));
	await db
		.update(missions)
		.set({ status: "in_progress", rejectionReason: reason })
		.where(and(eq(missions.companyId, companyId), eq(missions.id, mission.id)));
	return {
		submission: rowToSubmission({
			...sub,
			status: "rejected",
			rejectionReason: reason,
			reviewedAt: now,
		}),
		mission: rowToMission({
			...mission,
			status: "in_progress",
			rejectionReason: reason,
		}),
	};
}
