import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { requireApiUser } from "./api-guard";
import type { AuthUser } from "./permissions";

const getCurrentUser = vi.fn<() => Promise<AuthUser | null>>();

vi.mock("./nextauth", () => ({
	getCurrentUser: () => getCurrentUser(),
}));

const owner: AuthUser = {
	id: "user-1",
	name: "Ana",
	email: "ana@example.com",
	companyId: "company-1",
	role: "owner",
	validationDomains: ["*"],
};

describe("requireApiUser", () => {
	beforeEach(() => {
		getCurrentUser.mockReset();
	});

	it("returns 401 JSON when no user is authenticated", async () => {
		getCurrentUser.mockResolvedValue(null);

		const response = await requireApiUser();

		expect(response).toBeInstanceOf(NextResponse);
		expect((response as NextResponse).status).toBe(401);
		await expect((response as NextResponse).json()).resolves.toEqual({
			error: "Authentication required.",
		});
	});

	it("returns the user when no operation guard is requested", async () => {
		getCurrentUser.mockResolvedValue(owner);

		await expect(requireApiUser()).resolves.toEqual(owner);
	});

	it("returns 403 when the user lacks operation permission", async () => {
		getCurrentUser.mockResolvedValue({ ...owner, role: "viewer" });

		const response = await requireApiUser("user.invite", "company-1");

		expect(response).toBeInstanceOf(NextResponse);
		expect((response as NextResponse).status).toBe(403);
		await expect((response as NextResponse).json()).resolves.toMatchObject({
			code: "forbidden",
		});
	});

	it("allows permitted operations for the same company", async () => {
		getCurrentUser.mockResolvedValue(owner);

		await expect(requireApiUser("user.invite", "company-1")).resolves.toEqual(
			owner,
		);
	});
});
