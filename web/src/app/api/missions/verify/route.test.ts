import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	requireApiUser,
	getGraphService,
	listCompanyUsers,
	submitTransferVerification,
	reviewTransferVerification,
} = vi.hoisted(() => ({
	requireApiUser: vi.fn(),
	getGraphService: vi.fn(),
	listCompanyUsers: vi.fn(),
	submitTransferVerification: vi.fn(),
	reviewTransferVerification: vi.fn(),
}));

vi.mock("@/auth/api-guard", () => ({ requireApiUser }));
vi.mock("@/server/graph", () => ({ getGraphService }));
vi.mock("@/server/users", () => ({ listCompanyUsers }));
vi.mock("@/server/missions", () => ({
	closeVerifiedMission: vi.fn(),
	reviewTransferVerification,
	submitTransferVerification,
}));

const { POST } = await import("./route");

const user = {
	id: "user-assessor",
	companyId: "company-a",
	name: "Assessor",
	email: "assessor@example.test",
	role: "validator" as const,
	validationDomains: [] as string[],
};

describe("transfer verification identity gates", () => {
	beforeEach(() => {
		requireApiUser.mockReset().mockResolvedValue(user);
		getGraphService.mockReset().mockReturnValue({
			readNode: vi.fn().mockResolvedValue({ id: "backup", type: "Person", name: "Backup" }),
		});
		listCompanyUsers.mockReset().mockResolvedValue([{ ...user, personNodeId: undefined }]);
		submitTransferVerification.mockReset();
		reviewTransferVerification.mockReset();
	});

	it("refuses assessment when the login has no canonical Person mapping", async () => {
		const response = await POST(new Request("http://local/api/missions/verify", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				action: "submit",
				missionId: "mission-1",
				backupPersonId: "backup",
				competencyLevel: 4,
				accessVerified: true,
				evidenceRefs: ["assessment:observed-run"],
			}),
		}));
		expect(response.status).toBe(422);
		expect(submitTransferVerification).not.toHaveBeenCalled();
	});

	it("refuses review when the validator has no canonical Person mapping", async () => {
		const response = await POST(new Request("http://local/api/missions/verify", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				action: "review",
				verificationId: "verification-1",
				decision: "approve",
			}),
		}));
		expect(response.status).toBe(422);
		expect(reviewTransferVerification).not.toHaveBeenCalled();
	});
});
