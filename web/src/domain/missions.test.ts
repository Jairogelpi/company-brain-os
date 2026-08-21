import { describe, expect, it } from "vitest";
import type { DetectedRisk } from "./risk-engine";
import {
	createMissionFromRisk,
	createMissionsFromReport,
	transitionMission,
	createContribution,
	createArtifact,
	computeMissionStats,
	completeMission,
	transferVerificationIssues,
	type TransferVerification,
} from "./missions";

const sampleRisk: DetectedRisk = {
	id: "risk-spof-k-filler",
	riskType: "single_point_of_failure",
	severity: "critical",
	sourceNodeId: "k-filler",
	sourceNodeName: "configurar llenadora",
	relatedNodeIds: ["pedro"],
	message: "Bus factor 1",
	confidence: 22,
	trigger: "test",
	ruleId: "test",
	ruleVersion: 1,
	inputFacts: {},
	evidenceRefs: [],
};

const mediumRisk: DetectedRisk = {
	id: "risk-undoc-k-signing",
	riskType: "undocumented_critical",
	severity: "high",
	sourceNodeId: "k-signing",
	sourceNodeName: "criterio para firmar",
	relatedNodeIds: [],
	message: "Undocumented",
	confidence: 40,
	trigger: "test",
	ruleId: "test",
	ruleVersion: 1,
	inputFacts: {},
	evidenceRefs: [],
};

const approvedVerification: TransferVerification = {
	id: "verification-1",
	missionId: "mission-spof-k-filler",
	targetNodeId: "k-filler",
	backupPersonId: "laura",
	assessorId: "user-pedro",
	assessorPersonId: "pedro",
	competencyLevel: 4,
	accessVerified: true,
	evidenceRefs: ["artifact:sop-1", "assessment:run-1"],
	status: "approved",
	reviewerId: "user-validator",
	reviewerPersonId: "validator",
	createdAt: "2026-08-01T00:00:00.000Z",
	reviewedAt: "2026-08-02T00:00:00.000Z",
};

describe("Mission System", () => {
	describe("createMissionFromRisk", () => {
		it("creates a mission with objective, assignees, and priority from a risk", () => {
			const mission = createMissionFromRisk(sampleRisk, "owner-1");

			expect(mission.status).toBe("open");
			expect(mission.objective).toContain("configurar llenadora");
			expect(mission.assigneeIds).toContain("pedro");
			expect(mission.priority).toBe("critical");
			expect(mission.riskId).toBe(sampleRisk.id);
		});

		it("accepts custom assignees and due date", () => {
			const mission = createMissionFromRisk(
				sampleRisk,
				"owner-1",
				["laura"],
				7,
			);

			expect(mission.assigneeIds).toEqual(["laura"]);
			expect(mission.dueDate).toBeDefined();
		});
	});

	describe("createMissionsFromReport", () => {
		it("creates missions for all risks sorted by severity", () => {
			const missions = createMissionsFromReport(
				[mediumRisk, sampleRisk],
				"owner-1",
			);

			expect(missions).toHaveLength(2);
			// Critical risk should come first
			expect(missions[0].priority).toBe("critical");
			expect(missions[1].priority).toBe("high");
		});

		it("respects maxMissions limit", () => {
			const missions = createMissionsFromReport(
				[sampleRisk, mediumRisk],
				"owner-1",
				1,
			);
			expect(missions).toHaveLength(1);
		});
	});

	describe("transitionMission", () => {
		it("transitions open → in_progress", () => {
			const mission = createMissionFromRisk(sampleRisk, "owner-1");
			const updated = transitionMission(mission, "in_progress");
			expect(updated.status).toBe("in_progress");
		});

		it("transitions through content validation but not directly to closure", () => {
			let m = createMissionFromRisk(sampleRisk, "owner-1");
			m = transitionMission(m, "in_progress");
			m = transitionMission(m, "submitted");
			m = transitionMission(m, "validated");
			expect(() => transitionMission(m, "closed")).toThrow();
		});

		it("throws on invalid transition", () => {
			const mission = createMissionFromRisk(sampleRisk, "owner-1");
			expect(() => transitionMission(mission, "validated")).toThrow();
		});

		it("open missions cannot bypass evidence and close directly", () => {
			const mission = createMissionFromRisk(sampleRisk, "owner-1");
			expect(() => transitionMission(mission, "closed")).toThrow();
		});
	});

	describe("createContribution", () => {
		it("creates a contribution linked to a mission", () => {
			const contrib = createContribution("mission-1", "pedro", "video", {
				transcript: "Pedro shows how to configure",
			});

			expect(contrib.missionId).toBe("mission-1");
			expect(contrib.mediaType).toBe("video");
			expect(contrib.transcript).toBe("Pedro shows how to configure");
		});
	});

	describe("createArtifact", () => {
		it("creates an artifact in draft state linked to a node", () => {
			const artifact = createArtifact(
				"mission-1",
				"SOP",
				"# Configuring the filler\n\nStep 1...",
				"k-filler",
			);

			expect(artifact.type).toBe("SOP");
			expect(artifact.validationState).toBe("draft");
			expect(artifact.linkedNodeId).toBe("k-filler");
		});
	});

	describe("computeMissionStats", () => {
		it("computes stats from a list of missions", () => {
			const m1 = createMissionFromRisk(sampleRisk, "owner-1");
			const m2 = createMissionFromRisk(mediumRisk, "owner-1");
			const validated = transitionMission(
				transitionMission(transitionMission(m1, "in_progress"), "submitted"),
				"validated",
			);
			const m1Closed = completeMission(validated, approvedVerification);

			const stats = computeMissionStats([m1Closed, m2]);

			expect(stats.total).toBe(2);
			expect(stats.closed).toBe(1);
			expect(stats.open).toBe(1);
			expect(stats.completionRate).toBe(50);
		});
	});

	describe("completeMission", () => {
		it("completes a validated mission", () => {
			let m = createMissionFromRisk(sampleRisk, "owner-1");
			m = transitionMission(m, "in_progress");
			m = transitionMission(m, "submitted");
			m = transitionMission(m, "validated");
			m = completeMission(m, approvedVerification);

			expect(m.status).toBe("closed");
		});

		it("throws if mission is not validated", () => {
			const m = createMissionFromRisk(sampleRisk, "owner-1");
			expect(() => completeMission(m, approvedVerification)).toThrow(/validated/);
		});

		it("rejects documentation-only, low competency, missing access, and self-review", () => {
			const mission = {
				...createMissionFromRisk(sampleRisk, "owner-1"),
				status: "validated" as const,
			};
			const invalid = {
				...approvedVerification,
				competencyLevel: 2,
				accessVerified: false,
				evidenceRefs: [],
				reviewerId: "user-laura",
				reviewerPersonId: "laura",
			};

			expect(transferVerificationIssues(mission, invalid)).toEqual([
				"insufficient_competency",
				"access_not_verified",
				"missing_evidence",
				"self_review",
			]);
			expect(() => completeMission(mission, invalid)).toThrow(/verified transfer/);
		});

		it("requires explicit canonical identities for assessor and reviewer", () => {
			const mission = {
				...createMissionFromRisk(sampleRisk, "owner-1"),
				status: "validated" as const,
			};
			const missingMappings = {
				...approvedVerification,
				assessorPersonId: undefined,
				reviewerPersonId: undefined,
			};
			expect(transferVerificationIssues(mission, missingMappings)).toEqual([
				"missing_assessor_mapping",
				"missing_reviewer_mapping",
			]);
		});
	});
});
