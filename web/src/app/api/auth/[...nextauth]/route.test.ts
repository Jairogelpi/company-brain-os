import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authPost, checkRateLimit } = vi.hoisted(() => ({
	authPost: vi.fn(),
	checkRateLimit: vi.fn(),
}));

vi.mock("@/auth/nextauth", () => ({
	handlers: {
		GET: vi.fn(),
		POST: authPost,
	},
}));
vi.mock("@/lib/rate-limiter", () => ({
	checkDistributedRateLimit: checkRateLimit,
}));

const { POST } = await import("./route");

function credentialsRequest() {
	return new NextRequest("http://local/api/auth/callback/credentials", {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded",
			"x-forwarded-for": "192.0.2.10",
		},
		body: new URLSearchParams({ email: "Owner@Example.com", password: "secret" }),
	});
}

describe("Auth.js credentials rate limit", () => {
	beforeEach(() => {
		authPost.mockReset().mockResolvedValue(new Response(null, { status: 200 }));
		checkRateLimit.mockReset().mockResolvedValue({ allowed: true, remaining: 4, retryAfter: 0 });
	});

	it("uses an IP plus hashed-email key and delegates allowed attempts", async () => {
		const response = await POST(credentialsRequest());
		expect(response.status).toBe(200);
		expect(checkRateLimit).toHaveBeenCalledWith(
			expect.stringMatching(/^signin:192\.0\.2\.10:[a-f0-9]{64}$/),
			10,
			5,
		);
		expect(authPost).toHaveBeenCalledTimes(1);
	});

	it("returns 429 without invoking password verification", async () => {
		checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 15 });
		const response = await POST(credentialsRequest());
		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("15");
		expect(authPost).not.toHaveBeenCalled();
	});
});
