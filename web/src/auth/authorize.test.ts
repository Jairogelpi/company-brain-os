import { beforeEach, describe, expect, it, vi } from "vitest";

const compare = vi.fn();
const limit = vi.fn();
const where = vi.fn(() => ({ limit }));
const from = vi.fn(() => ({ where }));
const select = vi.fn(() => ({ from }));
const createDb = vi.fn(() => ({ select }));

vi.mock("bcryptjs", () => ({ compare }));
vi.mock("@/db", () => ({ createDb }));

const { authorizeCredentials } = await import("./authorize");

describe("authorizeCredentials", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		limit.mockResolvedValue([]);
		compare.mockResolvedValue(false);
	});

	it("returns null for missing credentials", async () => {
		await expect(
			authorizeCredentials({ email: "", password: "secret" }),
		).resolves.toBeNull();
		await expect(
			authorizeCredentials({ email: "ana@example.com", password: "" }),
		).resolves.toBeNull();
		expect(createDb).not.toHaveBeenCalled();
	});

	it("normalizes email before lookup", async () => {
		limit.mockResolvedValue([]);

		await authorizeCredentials({
			email: "  ANA@EXAMPLE.COM ",
			password: "secret",
		});

		expect(where).toHaveBeenCalledTimes(1);
	});

	it("returns null for unknown email or invalid password", async () => {
		limit.mockResolvedValueOnce([]);
		await expect(
			authorizeCredentials({ email: "ana@example.com", password: "secret" }),
		).resolves.toBeNull();

		limit.mockResolvedValueOnce([
			{
				id: "user-1",
				name: "Ana",
				email: "ana@example.com",
				role: "owner",
				companyId: "company-1",
				validationDomains: ["*"],
				passwordHash: "hash",
			},
		]);
		compare.mockResolvedValueOnce(false);

		await expect(
			authorizeCredentials({ email: "ana@example.com", password: "bad" }),
		).resolves.toBeNull();
	});

	it("returns the Auth.js user payload for valid credentials", async () => {
		limit.mockResolvedValueOnce([
			{
				id: "user-1",
				name: "Ana",
				email: "ana@example.com",
				role: "owner",
				companyId: "company-1",
				validationDomains: ["*"],
				passwordHash: "hash",
			},
		]);
		compare.mockResolvedValueOnce(true);

		await expect(
			authorizeCredentials({ email: "ana@example.com", password: "secret" }),
		).resolves.toEqual({
			id: "user-1",
			name: "Ana",
			email: "ana@example.com",
			role: "owner",
			companyId: "company-1",
			validationDomains: ["*"],
		});
	});
});
