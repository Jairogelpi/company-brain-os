import type { DetectedRisk } from "./risk-engine";

// --- Mission entities ---

export type MissionStatus =
	| "open"
	| "in_progress"
	| "submitted"
	| "validated"
	| "closed";
export type MissionPriority = "low" | "medium" | "high" | "critical";

export interface Mission {
	id: string;
	objective: string;
	targetNodeId: string;
	targetNodeName: string;
	assigneeIds: string[];
	/** Single assigned employee (the one expected to deliver). */
	assigneeId?: string;
	/** Boss-authored detailed instructions of what to do. */
	instructions?: string;
	/** Reason the latest submission was rejected (shown to the employee). */
	rejectionReason?: string;
	priority: MissionPriority;
	dueDate?: string;
	status: MissionStatus;
	createdBy: string;
	createdAt: string;
	closedAt?: string;
	riskId?: string;
	detailedSteps?: string[];
	suggestedTrainerId?: string;
	suggestedTrainerName?: string;
	rationale?: string;
	riskNote?: string;
}

export type SubmissionStatus = "pending" | "approved" | "rejected";

/** An employee's deliverable for a mission: an uploaded file or written text. */
export interface MissionSubmission {
	id: string;
	missionId: string;
	authorId: string;
	kind: "file" | "text";
	text?: string;
	storageUrl?: string;
	fileName?: string;
	mimeType?: string;
	mediaType?: string;
	status: SubmissionStatus;
	reviewerId?: string;
	rejectionReason?: string;
	createdAt: string;
	reviewedAt?: string;
}

export type TransferVerificationStatus = "proposed" | "approved" | "rejected";

export interface TransferVerification {
	id: string;
	missionId: string;
	targetNodeId: string;
	backupPersonId: string;
	assessorId: string;
	/** Canonical Person node for the authenticated assessor. */
	assessorPersonId?: string;
	competencyLevel: number;
	accessVerified: boolean;
	evidenceRefs: string[];
	status: TransferVerificationStatus;
	reviewerId?: string;
	/** Canonical Person node for the authenticated independent reviewer. */
	reviewerPersonId?: string;
	rejectionReason?: string;
	createdAt: string;
	reviewedAt?: string;
}

export type TransferVerificationIssue =
	| "mission_not_validated"
	| "mission_mismatch"
	| "missing_backup"
	| "missing_assessor_mapping"
	| "missing_reviewer_mapping"
	| "insufficient_competency"
	| "access_not_verified"
	| "missing_evidence"
	| "self_assessment"
	| "self_review";

export function transferVerificationIssues(
	mission: Pick<Mission, "id" | "targetNodeId" | "status">,
	verification: Pick<
		TransferVerification,
		"missionId" | "targetNodeId" | "backupPersonId" | "assessorId" | "assessorPersonId" | "reviewerId" | "reviewerPersonId" | "competencyLevel" | "accessVerified" | "evidenceRefs" | "status"
	>,
): TransferVerificationIssue[] {
	const issues: TransferVerificationIssue[] = [];
	if (mission.status !== "validated") issues.push("mission_not_validated");
	if (verification.missionId !== mission.id || verification.targetNodeId !== mission.targetNodeId) {
		issues.push("mission_mismatch");
	}
	if (!verification.backupPersonId.trim()) issues.push("missing_backup");
	if (!verification.assessorPersonId?.trim()) issues.push("missing_assessor_mapping");
	if (!Number.isInteger(verification.competencyLevel) || verification.competencyLevel < 3 || verification.competencyLevel > 5) {
		issues.push("insufficient_competency");
	}
	if (!verification.accessVerified) issues.push("access_not_verified");
	if (verification.evidenceRefs.length === 0 || verification.evidenceRefs.some((ref) => !ref.trim())) {
		issues.push("missing_evidence");
	}
	if (verification.assessorPersonId === verification.backupPersonId) issues.push("self_assessment");
	if (verification.status === "approved" && !verification.reviewerPersonId?.trim()) {
		issues.push("missing_reviewer_mapping");
	}
	if (
		verification.reviewerId &&
		(verification.reviewerId === verification.assessorId ||
			(Boolean(verification.reviewerPersonId) &&
				(verification.reviewerPersonId === verification.assessorPersonId ||
					verification.reviewerPersonId === verification.backupPersonId)))
	) {
		issues.push("self_review");
	}
	return issues;
}

export type MediaType =
	| "audio"
	| "video"
	| "image"
	| "document"
	| "screen"
	| "drawing"
	| "chat";

export interface Contribution {
	id: string;
	missionId: string;
	authorId: string;
	mediaType: MediaType;
	storageUrl?: string;
	transcript?: string;
	ocrText?: string;
	createdAt: string;
}

export type ArtifactType =
	| "SOP"
	| "checklist"
	| "FAQ"
	| "manual"
	| "quick_guide"
	| "knowledge_card"
	| "diagram";

export interface Artifact {
	id: string;
	missionId: string;
	type: ArtifactType;
	content: string;
	linkedNodeId?: string;
	validationState: "draft" | "proposed" | "validated" | "retired";
	createdAt: string;
}

// --- Mission state machine ---

export const VALID_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
	open: ["in_progress"],
	in_progress: ["submitted"],
	submitted: ["validated", "in_progress"],
	validated: [],
	closed: [],
};

export function transitionMission(
	mission: Mission,
	to: MissionStatus,
): Mission {
	if (!VALID_TRANSITIONS[mission.status].includes(to)) {
		throw new Error(
			`Invalid mission transition: ${mission.status} → ${to}. Valid: ${VALID_TRANSITIONS[mission.status].join(", ") || "none"}`,
		);
	}
	const now = new Date().toISOString();
	return {
		...mission,
		status: to,
		closedAt: to === "closed" ? now : mission.closedAt,
	};
}

// --- Mission creation from risks ---

export function createMissionFromRisk(
	risk: DetectedRisk,
	createdBy: string,
	assigneeIds?: string[],
	dueDays?: number,
): Mission {
	const priorityMap: Record<string, MissionPriority> = {
		critical: "critical",
		high: "high",
		medium: "medium",
	};

	const dueDate = dueDays
		? new Date(Date.now() + dueDays * 86400000).toISOString()
		: undefined;

	return {
		id: `mission-${risk.id.replace("risk-", "")}`,
		objective: `Document and transfer: ${risk.sourceNodeName}`,
		targetNodeId: risk.sourceNodeId,
		targetNodeName: risk.sourceNodeName,
		assigneeIds: assigneeIds ?? [...risk.relatedNodeIds],
		priority: priorityMap[risk.severity] ?? "medium",
		dueDate,
		status: "open",
		createdBy,
		createdAt: new Date().toISOString(),
		riskId: risk.id,
	};
}

export function createMissionsFromReport(
	risks: DetectedRisk[],
	createdBy: string,
	maxMissions?: number,
): Mission[] {
	const prioritized = [...risks].sort((a, b) => {
		const order = { critical: 0, high: 1, medium: 2 };
		return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
	});

	const limit = maxMissions ?? prioritized.length;
	return prioritized
		.slice(0, limit)
		.map((risk) => createMissionFromRisk(risk, createdBy));
}

// --- Contribution factory ---

let nextContributionId = 1;

export function createContribution(
	missionId: string,
	authorId: string,
	mediaType: MediaType,
	partial?: Partial<
		Pick<Contribution, "transcript" | "ocrText" | "storageUrl">
	>,
): Contribution {
	return {
		id: `contrib-${nextContributionId++}`,
		missionId,
		authorId,
		mediaType,
		storageUrl: partial?.storageUrl,
		transcript: partial?.transcript,
		ocrText: partial?.ocrText,
		createdAt: new Date().toISOString(),
	};
}

// --- Artifact factory ---

let nextArtifactId = 1;

export function createArtifact(
	missionId: string,
	type: ArtifactType,
	content: string,
	linkedNodeId?: string,
): Artifact {
	return {
		id: `artifact-${nextArtifactId++}`,
		missionId,
		type,
		content,
		linkedNodeId,
		validationState: "draft",
		createdAt: new Date().toISOString(),
	};
}

// --- Mission completion ---

export interface MissionStats {
	total: number;
	open: number;
	inProgress: number;
	submitted: number;
	validated: number;
	closed: number;
	completionRate: number; // 0–100
}

export function computeMissionStats(missions: Mission[]): MissionStats {
	const total = missions.length;
	const counts: Record<MissionStatus, number> = {
		open: 0,
		in_progress: 0,
		submitted: 0,
		validated: 0,
		closed: 0,
	};

	for (const m of missions) {
		counts[m.status]++;
	}

	return {
		total,
		open: counts.open,
		inProgress: counts.in_progress,
		submitted: counts.submitted,
		validated: counts.validated,
		closed: counts.closed,
		completionRate: total > 0 ? Math.round((counts.closed / total) * 100) : 0,
	};
}

/**
 * Close a loop: mission completed → risk status can be lowered.
 * Returns the updated mission with status "closed".
 */
export function completeMission(
	mission: Mission,
	verification: TransferVerification,
): Mission {
	if (mission.status === "closed") return mission;
	if (mission.status !== "validated") {
		throw new Error(
			`Cannot close mission in status "${mission.status}". Must be "validated" first.`,
		);
	}
	const issues = transferVerificationIssues(mission, verification);
	if (verification.status !== "approved" || issues.length > 0) {
		throw new Error(`Cannot close mission without approved verified transfer: ${issues.join(", ") || "verification_not_approved"}`);
	}
	return { ...mission, status: "closed", closedAt: new Date().toISOString() };
}
