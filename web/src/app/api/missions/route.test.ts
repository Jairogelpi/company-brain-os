import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUserMock = vi.fn();
const listMissionsMock = vi.fn();
const saveMissionsMock = vi.fn();
const transitionMissionStatusMock = vi.fn();

vi.mock("@/auth/api-guard", () => ({ requireApiUser: requireApiUserMock }));
vi.mock("@/server/missions", () => ({
	listMissions: listMissionsMock,
	saveMissions: saveMissionsMock,
	transitionMissionStatus: transitionMissionStatusMock,
}));

const { POST } = await import("./route");

function authedUser() {
	return {
		id: "owner-1",
		companyId: "companyA",
		role: "owner" as const,
		name: "Owner",
		email: "owner@example.com",
		validationDomains: [] as string[],
	};
}

async function post(body: unknown) {
	const res = await POST(
		new Request("http://localhost/api/missions", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);
	return { status: res.status, json: await res.json() };
}

describe("POST /api/missions", () => {
	beforeEach(() => {
		requireApiUserMock.mockReset().mockResolvedValue(authedUser());
		saveMissionsMock.mockReset().mockResolvedValue(1);
	});

	it("forwards optional enrichment fields to saveMissions", async () => {
		const { status, json } = await post({
			personId: "person-pedro",
			actions: [
				{
					knowledgeId: "k-filler",
					knowledgeName: "Filler",
					criticality: "high",
					action: "Document filler",
					targetDate: "2026-02-01",
					detailedSteps: ["step 1"],
					suggestedTrainerId: "person-ada",
					suggestedTrainerName: "Ada",
					rationale: "critical",
					riskNote: "risk",
				},
			],
		});

		expect(status).toBe(200);
		expect(json.saved).toBe(1);
		expect(saveMissionsMock).toHaveBeenCalledWith(
			"companyA",
			"person-pedro",
			expect.arrayContaining([
				expect.objectContaining({
					detailedSteps: ["step 1"],
					suggestedTrainerId: "person-ada",
					suggestedTrainerName: "Ada",
					rationale: "critical",
					riskNote: "risk",
				}),
			]),
		);
	});

	it("still accepts heuristic-only actions", async () => {
		const { status } = await post({
			actions: [
				{
					knowledgeId: "k-filler",
					knowledgeName: "Filler",
					criticality: "high",
					action: "Document filler",
				},
			],
		});

		expect(status).toBe(200);
		expect(saveMissionsMock).toHaveBeenCalledOnce();
	});
});
