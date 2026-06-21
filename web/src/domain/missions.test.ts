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

		it("transitions through full lifecycle", () => {
			let m = createMissionFromRisk(sampleRisk, "owner-1");
			m = transitionMission(m, "in_progress");
			m = transitionMission(m, "submitted");
			m = transitionMission(m, "validated");
			m = transitionMission(m, "closed");
			expect(m.status).toBe("closed");
			expect(m.closedAt).toBeDefined();
		});

		it("throws on invalid transition", () => {
			const mission = createMissionFromRisk(sampleRisk, "owner-1");
			expect(() => transitionMission(mission, "validated")).toThrow();
		});

		it("closed missions cannot transition further", () => {
			let m = createMissionFromRisk(sampleRisk, "owner-1");
			m = transitionMission(m, "closed");
			expect(() => transitionMission(m, "in_progress")).toThrow();
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
			const m1Closed = transitionMission(
				transitionMission(
					transitionMission(transitionMission(m1, "in_progress"), "submitted"),
					"validated",
				),
				"closed",
			);

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
			m = completeMission(m);

			expect(m.status).toBe("closed");
		});

		it("throws if mission is not validated", () => {
			const m = createMissionFromRisk(sampleRisk, "owner-1");
			expect(() => completeMission(m)).toThrow(/validated/);
		});
	});
});
