import { beforeEach, describe, expect, it, vi } from "vitest";

const { acceptInvitation, checkRateLimit } = vi.hoisted(() => ({
	acceptInvitation: vi.fn(),
	checkRateLimit: vi.fn(),
}));
vi.mock("@/server/invitations", () => ({ acceptInvitation }));
vi.mock("@/lib/rate-limiter", () => ({ checkDistributedRateLimit: checkRateLimit }));

const { POST } = await import("./route");

function request() {
	return new Request("http://local/api/auth/accept-invite", {
		method: "POST",
		headers: { "content-type": "application/json", "x-real-ip": "192.0.2.5" },
		body: JSON.stringify({ token: "token", name: "Laura", password: "correct-horse-battery" }),
	});
}

describe("POST /api/auth/accept-invite", () => {
	beforeEach(() => {
		checkRateLimit.mockReset().mockResolvedValue({ allowed: true, remaining: 4, retryAfter: 0 });
		acceptInvitation.mockReset().mockResolvedValue({ id: "user-1", email: "laura@example.test", companyId: "acme", role: "contributor" });
	});

	it("creates the invited account after rate limiting", async () => {
		const response = await POST(request());
		expect(response.status).toBe(201);
		expect(acceptInvitation).toHaveBeenCalledWith(expect.objectContaining({ name: "Laura" }));
	});

	it("blocks abusive attempts before token processing", async () => {
		checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 20 });
		const response = await POST(request());
		expect(response.status).toBe(429);
		expect(acceptInvitation).not.toHaveBeenCalled();
	});
});
