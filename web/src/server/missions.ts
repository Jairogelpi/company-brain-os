import { and, eq } from "drizzle-orm";
import { createDb } from "@/db";
import {
	missions,
	missionSubmissions,
	missionTransferVerifications,
	users,
} from "@/db/schema";
import {
	completeMission,
	transferVerificationIssues,
	VALID_TRANSITIONS,
	type Mission,
	type MissionStatus,
	type MissionSubmission,
	type TransferVerification,
} from "@/domain/missions";
import {
	withTenantTransaction,
	type TenantTransaction,
} from "@/db/tenant-transaction";
import { refreshStoredUploadUrl } from "@/lib/upload-security";
import { enqueueMissionAssignment } from "@/server/notifications";

/** DB-backed missions, scoped to a company (tenant). */

type Row = typeof missions.$inferSelect;
type SubRow = typeof missionSubmissions.$inferSelect;
type VerificationRow = typeof missionTransferVerifications.$inferSelect;

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
		storageUrl: refreshStoredUploadUrl(r.companyId, r.storageUrl ?? undefined),
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

function rowToTransferVerification(r: VerificationRow): TransferVerification {
	return {
		id: r.id,
		missionId: r.missionId,
		targetNodeId: r.targetNodeId,
		backupPersonId: r.backupPersonId,
		assessorId: r.assessorId,
		assessorPersonId: r.assessorPersonId ?? undefined,
		competencyLevel: r.competencyLevel,
		accessVerified: r.accessVerified,
		evidenceRefs: r.evidenceRefs,
		status: r.status,
		reviewerId: r.reviewerId ?? undefined,
		reviewerPersonId: r.reviewerPersonId ?? undefined,
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
	const db = createDb();
	await withTenantTransaction(db, companyId, (tx) => tx.insert(missions)
		.values(
			rows.map((r) => ({ ...r, companyId, personId, status: "open" as const })),
		));
	return rows.length;
}

export async function listMissions(companyId: string): Promise<Mission[]> {
	const db = createDb();
	const rows = await withTenantTransaction(db, companyId, (tx) => tx.select()
		.from(missions)
		.where(eq(missions.companyId, companyId))
		.orderBy(missions.createdAt));
	return rows.map(rowToMission);
}

export async function readMission(
	companyId: string,
	id: string,
): Promise<Mission | undefined> {
	const db = createDb();
	const rows = await withTenantTransaction(db, companyId, (tx) => tx.select()
		.from(missions)
		.where(and(eq(missions.companyId, companyId), eq(missions.id, id)))
		.limit(1));
	return rows[0] ? rowToMission(rows[0]) : undefined;
}

async function getMission(
	db: TenantTransaction,
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
	return withTenantTransaction(db, companyId, async (tx) => {
		const current = await getMission(tx, companyId, id);
		const requestedAssignee = patch.assigneeId === undefined
			? current.assigneeId
			: patch.assigneeId.trim() || null;
		let assignee: { id: string; email: string } | undefined;
		if (requestedAssignee && requestedAssignee !== current.assigneeId) {
			const rows = await tx
				.select({ id: users.id, email: users.email })
				.from(users)
				.where(and(
					eq(users.id, requestedAssignee),
					eq(users.companyId, companyId),
				))
				.limit(1);
			assignee = rows[0];
			if (!assignee) throw new Error(`Assignee is not a company user: ${requestedAssignee}`);
		}
		await tx
			.update(missions)
			.set({
				assigneeId: requestedAssignee,
				instructions: patch.instructions ?? current.instructions,
			})
			.where(and(eq(missions.companyId, companyId), eq(missions.id, id)));
		if (assignee) {
			await enqueueMissionAssignment(tx, {
				companyId,
				recipientId: assignee.id,
				recipientEmail: assignee.email,
				missionId: current.id,
				missionObjective: current.objective,
			});
		}
		return rowToMission({
			...current,
			assigneeId: requestedAssignee,
			instructions: patch.instructions ?? current.instructions,
		});
	});
}

/** Transition a mission, enforcing the domain's allowed transitions + tenancy. */
export async function transitionMissionStatus(
	companyId: string,
	id: string,
	to: MissionStatus,
): Promise<Mission> {
	const db = createDb();
	return withTenantTransaction(db, companyId, async (tx) => {
	const current = await getMission(tx, companyId, id);
	if (to === "closed") {
		throw new Error("Mission closure requires an approved transfer verification");
	}
	if (!VALID_TRANSITIONS[current.status].includes(to)) {
		throw new Error(
			`Invalid transition ${current.status} → ${to}. Valid: ${
				VALID_TRANSITIONS[current.status].join(", ") || "none"
			}`,
		);
	}
	await tx
		.update(missions)
			.set({
				status: to,
				closedAt: current.closedAt,
		})
		.where(and(eq(missions.companyId, companyId), eq(missions.id, id)));
	return rowToMission({ ...current, status: to });
	});
}

// --- Submissions ---

export async function listSubmissions(
	companyId: string,
): Promise<MissionSubmission[]> {
	const db = createDb();
	const rows = await withTenantTransaction(db, companyId, (tx) => tx.select()
		.from(missionSubmissions)
		.where(eq(missionSubmissions.companyId, companyId))
		.orderBy(missionSubmissions.createdAt));
	return rows.map(rowToSubmission);
}

export async function listTransferVerifications(
	companyId: string,
): Promise<TransferVerification[]> {
	const db = createDb();
	const rows = await withTenantTransaction(db, companyId, (tx) => tx
		.select()
		.from(missionTransferVerifications)
		.where(eq(missionTransferVerifications.companyId, companyId))
		.orderBy(missionTransferVerifications.createdAt));
	return rows.map(rowToTransferVerification);
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
	return withTenantTransaction(db, companyId, async (tx) => {
	const mission = await getMission(tx, companyId, input.missionId);

	const id = `sub-${globalThis.crypto.randomUUID()}`;
	const [row] = await tx
		.insert(missionSubmissions)
		.values({ ...input, id, companyId, status: "pending" })
		.returning();

	// open|in_progress → submitted (re-submission after a rejection re-enters
	// the review queue).
	const next = mission.status === "open" ? "in_progress" : mission.status;
	await tx
		.update(missions)
		.set({ status: "submitted", rejectionReason: null })
		.where(
			and(eq(missions.companyId, companyId), eq(missions.id, input.missionId)),
		);
	void next;
	return rowToSubmission(row);
	});
}

export type ReviewResult = {
	submission: MissionSubmission;
	mission: Mission;
	/** Set when approved content should be recorded as documentation evidence. */
	approvedTargetNodeId?: string;
};

/**
 * Boss reviews a submission. Approve → submission approved and mission
 * validated, but NOT closed. Closure requires separate evidence that a backup
 * can perform the work with the required access. Reject →
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
	return withTenantTransaction(db, companyId, async (tx) => {
	const subRows = await tx
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
	const mission = await getMission(tx, companyId, sub.missionId);
	if (sub.authorId === input.reviewerId) {
		throw new Error("A submission author cannot review their own evidence");
	}
	if (sub.status !== "pending") {
		const decidedStatus = input.decision === "approve" ? "approved" : "rejected";
		if (sub.reviewerId === input.reviewerId && sub.status === decidedStatus) {
			return {
				submission: rowToSubmission(sub),
				mission: rowToMission(mission),
				...(sub.status === "approved" ? { approvedTargetNodeId: mission.targetNodeId } : {}),
			};
		}
		throw new Error(`Submission already reviewed: ${sub.status}`);
	}

	const now = new Date();
	if (input.decision === "approve") {
		const [reviewed] = await tx
			.update(missionSubmissions)
			.set({ status: "approved", reviewerId: input.reviewerId, reviewedAt: now })
			.where(and(
				eq(missionSubmissions.companyId, companyId),
				eq(missionSubmissions.id, sub.id),
				eq(missionSubmissions.status, "pending"),
			))
			.returning();
		if (!reviewed) throw new Error("Submission was reviewed concurrently");
		await tx
			.update(missions)
			.set({ status: "validated", closedAt: null, rejectionReason: null })
			.where(and(eq(missions.companyId, companyId), eq(missions.id, mission.id)));
		return {
			submission: rowToSubmission(reviewed),
			mission: rowToMission({ ...mission, status: "validated", closedAt: null }),
			approvedTargetNodeId: mission.targetNodeId,
		};
	}

	const reason = (input.rejectionReason ?? "").trim() || "No reason given.";
	const [reviewed] = await tx
		.update(missionSubmissions)
		.set({
			status: "rejected",
			reviewerId: input.reviewerId,
			rejectionReason: reason,
			reviewedAt: now,
		})
		.where(and(
			eq(missionSubmissions.companyId, companyId),
			eq(missionSubmissions.id, sub.id),
			eq(missionSubmissions.status, "pending"),
		))
		.returning();
	if (!reviewed) throw new Error("Submission was reviewed concurrently");
	await tx
		.update(missions)
		.set({ status: "in_progress", rejectionReason: reason })
		.where(and(eq(missions.companyId, companyId), eq(missions.id, mission.id)));
	return {
		submission: rowToSubmission(reviewed),
		mission: rowToMission({
			...mission,
			status: "in_progress",
			rejectionReason: reason,
		}),
	};
	});
}

export async function submitTransferVerification(
	companyId: string,
	input: {
		missionId: string;
		backupPersonId: string;
		assessorId: string;
		assessorPersonId: string;
		competencyLevel: number;
		accessVerified: boolean;
		evidenceRefs: string[];
	},
): Promise<TransferVerification> {
	const db = createDb();
	return withTenantTransaction(db, companyId, async (tx) => {
	const missionRow = await getMission(tx, companyId, input.missionId);
	const mission = rowToMission(missionRow);
	const candidate: TransferVerification = {
		id: `verify-${globalThis.crypto.randomUUID()}`,
		missionId: mission.id,
		targetNodeId: mission.targetNodeId,
		backupPersonId: input.backupPersonId.trim(),
		assessorId: input.assessorId,
		assessorPersonId: input.assessorPersonId,
		competencyLevel: input.competencyLevel,
		accessVerified: input.accessVerified,
		evidenceRefs: [...new Set(input.evidenceRefs.map((ref) => ref.trim()).filter(Boolean))],
		status: "proposed",
		createdAt: new Date().toISOString(),
	};
	const issues = transferVerificationIssues(mission, candidate);
	if (issues.length > 0) throw new Error(`Invalid transfer verification: ${issues.join(", ")}`);
	const [row] = await tx.insert(missionTransferVerifications).values({
		id: candidate.id,
		companyId,
		missionId: candidate.missionId,
		targetNodeId: candidate.targetNodeId,
		backupPersonId: candidate.backupPersonId,
		assessorId: candidate.assessorId,
		assessorPersonId: candidate.assessorPersonId,
		competencyLevel: candidate.competencyLevel,
		accessVerified: candidate.accessVerified,
		evidenceRefs: candidate.evidenceRefs,
		status: "proposed",
	}).returning();
	return rowToTransferVerification(row);
	});
}

export async function reviewTransferVerification(
	companyId: string,
	input: {
			verificationId: string;
			reviewerId: string;
			reviewerPersonId: string;
		decision: "approve" | "reject";
		rejectionReason?: string;
	},
): Promise<{ verification: TransferVerification; mission: Mission }> {
	const db = createDb();
	return withTenantTransaction(db, companyId, async (tx) => {
	const rows = await tx.select().from(missionTransferVerifications).where(and(
		eq(missionTransferVerifications.companyId, companyId),
		eq(missionTransferVerifications.id, input.verificationId),
	)).limit(1);
	const row = rows[0];
	if (!row) throw new Error(`Transfer verification not found: ${input.verificationId}`);
	if (row.status !== "proposed") {
		const sameDecision = (input.decision === "approve" && row.status === "approved") ||
			(input.decision === "reject" && row.status === "rejected");
		if (sameDecision && row.reviewerId === input.reviewerId && row.reviewerPersonId === input.reviewerPersonId) {
			return {
				verification: rowToTransferVerification(row),
				mission: rowToMission(await getMission(tx, companyId, row.missionId)),
			};
		}
		throw new Error(`Transfer verification already reviewed: ${row.status}`);
	}
	if (input.reviewerPersonId === row.backupPersonId) {
		throw new Error("The assessed backup cannot review their own transfer verification");
	}
	const mission = rowToMission(await getMission(tx, companyId, row.missionId));
	const now = new Date();
	const candidate: TransferVerification = {
		...rowToTransferVerification(row),
		status: input.decision === "approve" ? "approved" : "rejected",
		reviewerId: input.reviewerId,
		reviewerPersonId: input.reviewerPersonId,
		rejectionReason: input.rejectionReason?.trim() || undefined,
		reviewedAt: now.toISOString(),
	};
	if (input.decision === "approve") {
		const issues = transferVerificationIssues(mission, candidate);
		if (issues.length > 0) throw new Error(`Invalid transfer verification: ${issues.join(", ")}`);
	} else if (!candidate.rejectionReason) {
		throw new Error("A rejection reason is required");
	}
	const [updated] = await tx.update(missionTransferVerifications).set({
		status: candidate.status,
		reviewerId: input.reviewerId,
		reviewerPersonId: input.reviewerPersonId,
		rejectionReason: candidate.rejectionReason ?? null,
		reviewedAt: now,
	}).where(and(
		eq(missionTransferVerifications.companyId, companyId),
		eq(missionTransferVerifications.id, row.id),
		eq(missionTransferVerifications.status, "proposed"),
	)).returning();
	if (!updated) {
		const [concurrent] = await tx.select().from(missionTransferVerifications).where(and(
			eq(missionTransferVerifications.companyId, companyId),
			eq(missionTransferVerifications.id, row.id),
		)).limit(1);
		if (concurrent?.status === candidate.status && concurrent.reviewerId === input.reviewerId && concurrent.reviewerPersonId === input.reviewerPersonId) {
			return { verification: rowToTransferVerification(concurrent), mission };
		}
		throw new Error("Transfer verification was reviewed concurrently");
	}
	return { verification: rowToTransferVerification(updated), mission };
	});
}

export async function closeVerifiedMission(
	companyId: string,
	missionId: string,
	verificationId: string,
): Promise<Mission> {
	const db = createDb();
	return withTenantTransaction(db, companyId, async (tx) => {
	const missionRow = await getMission(tx, companyId, missionId);
	const verificationRows = await tx.select().from(missionTransferVerifications).where(and(
		eq(missionTransferVerifications.companyId, companyId),
		eq(missionTransferVerifications.id, verificationId),
		eq(missionTransferVerifications.missionId, missionId),
	)).limit(1);
	if (!verificationRows[0]) throw new Error(`Transfer verification not found: ${verificationId}`);
	const completed = completeMission(rowToMission(missionRow), rowToTransferVerification(verificationRows[0]));
	await tx.update(missions).set({ status: "closed", closedAt: new Date(completed.closedAt!) }).where(and(
		eq(missions.companyId, companyId),
		eq(missions.id, missionId),
	));
	return completed;
	});
}
