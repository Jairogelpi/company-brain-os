import { describe, expect, it } from "vitest";
import { rowToMission } from "./missions";
import type { missions } from "@/db/schema";

describe("mission enrichment mapping", () => {
	it("round-trips optional enrichment fields from DB rows", () => {
		const now = new Date("2026-01-01T00:00:00.000Z");
		const row: typeof missions.$inferSelect = {
			id: "mission-1",
			companyId: "companyA",
			personId: "person-pedro",
			objective: "Document filler",
			targetNodeId: "k-filler",
			targetNodeName: "Filler",
			assigneeIds: [],
			priority: "high",
			dueDate: "2026-02-01",
			status: "open",
			createdBy: "owner-1",
			createdAt: now,
			closedAt: null,
			detailedSteps: ["step 1", "step 2"],
			suggestedTrainerId: "person-ada",
			suggestedTrainerName: "Ada",
			rationale: "critical",
			riskNote: "risk",
		};

		expect(rowToMission(row)).toMatchObject({
			detailedSteps: ["step 1", "step 2"],
			suggestedTrainerId: "person-ada",
			suggestedTrainerName: "Ada",
			rationale: "critical",
			riskNote: "risk",
		});
	});

	it("omits enrichment fields for heuristic-only rows", () => {
		const now = new Date("2026-01-01T00:00:00.000Z");
		const row: typeof missions.$inferSelect = {
			id: "mission-1",
			companyId: "companyA",
			personId: null,
			objective: "Document filler",
			targetNodeId: "k-filler",
			targetNodeName: "Filler",
			assigneeIds: [],
			priority: "high",
			dueDate: null,
			status: "open",
			createdBy: "owner-1",
			createdAt: now,
			closedAt: null,
			detailedSteps: null,
			suggestedTrainerId: null,
			suggestedTrainerName: null,
			rationale: null,
			riskNote: null,
		};

		const mission = rowToMission(row);
		expect(mission.detailedSteps).toBeUndefined();
		expect(mission.rationale).toBeUndefined();
	});
});
