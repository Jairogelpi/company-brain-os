import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiUser, createDb, getGraphService } = vi.hoisted(() => ({
	requireApiUser: vi.fn(),
	createDb: vi.fn(),
	getGraphService: vi.fn(),
}));

vi.mock("@/auth/api-guard", () => ({ requireApiUser }));
vi.mock("@/db", () => ({ createDb }));
vi.mock("@/server/graph", () => ({ getGraphService }));

const { GET, PATCH } = await import("./route");

const contributor = {
	id: "user-a",
	companyId: "company-a",
	role: "contributor" as const,
	name: "Ana",
	email: "ana@example.test",
	validationDomains: [] as string[],
};

describe("user profile authorization", () => {
	beforeEach(() => {
		requireApiUser.mockReset().mockResolvedValue(contributor);
		createDb.mockReset();
		getGraphService.mockReset();
	});

	it("does not expose another employee's HR profile to a contributor", async () => {
		const response = await GET(new Request("http://local/api/users/user-b"), {
			params: Promise.resolve({ id: "user-b" }),
		});
		expect(response.status).toBe(403);
		expect(createDb).not.toHaveBeenCalled();
	});

	it("does not let a non-owner edit salary or contract fields", async () => {
		const response = await PATCH(new Request("http://local/api/users/user-a", {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ salary: 100000 }),
		}), { params: Promise.resolve({ id: "user-a" }) });
		expect(response.status).toBe(403);
		expect(createDb).not.toHaveBeenCalled();
	});

	it("rejects invalid self-service names before persistence", async () => {
		const response = await PATCH(new Request("http://local/api/users/user-a", {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "" }),
		}), { params: Promise.resolve({ id: "user-a" }) });
		expect(response.status).toBe(422);
		expect(createDb).not.toHaveBeenCalled();
	});

	it("only maps an owner to a Person that exists in the same tenant", async () => {
		requireApiUser.mockResolvedValue({ ...contributor, role: "owner" });
		getGraphService.mockReturnValue({ readNode: vi.fn().mockResolvedValue(undefined) });
		const response = await PATCH(new Request("http://local/api/users/user-a", {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ personNodeId: "person-from-another-tenant" }),
		}), { params: Promise.resolve({ id: "user-a" }) });
		expect(response.status).toBe(422);
		expect(createDb).not.toHaveBeenCalled();
	});
});
