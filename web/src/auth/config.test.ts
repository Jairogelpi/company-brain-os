import { describe, expect, it } from "vitest";
import { authConfig } from "./config";

describe("authConfig callbacks", () => {
	it("copies company auth fields from user to JWT", async () => {
		const jwt = authConfig.callbacks?.jwt;
		expect(jwt).toBeDefined();

		const token = jwt!({
			token: {},
			user: {
				id: "user-1",
				role: "owner",
				companyId: "company-1",
				validationDomains: ["*"],
			},
			account: null,
			profile: undefined,
			trigger: "signIn",
			isNewUser: false,
			session: undefined,
		});

		expect(token).toMatchObject({
			id: "user-1",
			role: "owner",
			companyId: "company-1",
			validationDomains: ["*"],
		});
	});

	it("exposes JWT domain fields on session.user", async () => {
		const sessionCallback = authConfig.callbacks?.session;
		expect(sessionCallback).toBeDefined();

		const session = sessionCallback!({
			session: {
				user: {
					id: "fallback-user",
					name: "Ana",
					email: "ana@example.com",
				},
				expires: new Date(Date.now() + 1_000).toISOString(),
			} as never,
			token: {
				id: "user-1",
				role: "owner",
				companyId: "company-1",
				validationDomains: ["*"],
			} as never,
			user: {
				id: "user-1",
				email: "ana@example.com",
				emailVerified: null,
				role: "owner",
				companyId: "company-1",
				validationDomains: ["*"],
			} as never,
			newSession: undefined,
			trigger: "update",
		});

		expect(session.user).toMatchObject({
			id: "user-1",
			role: "owner",
			companyId: "company-1",
			validationDomains: ["*"],
		});
	});

	it("allows public login, register, and API routes while protecting app pages", async () => {
		const authorized = authConfig.callbacks?.authorized;
		expect(authorized).toBeDefined();

		for (const pathname of [
			"/login",
			"/register",
			"/accept-invite",
			"/api/graph",
			"/_next/static/app.js",
			"/favicon.ico",
		]) {
			expect(
				authorized!({
					auth: null,
					request: { nextUrl: { pathname } } as never,
				}),
			).toBe(true);
		}

		expect(
			authorized!({
				auth: null,
				request: { nextUrl: { pathname: "/dashboard" } } as never,
			}),
		).toBe(false);
	});

	it("does not authorize app pages without an active organization", async () => {
		const authorized = authConfig.callbacks?.authorized;
		expect(authorized!({ auth: { user: { id: "user-1" } } as never, request: { nextUrl: { pathname: "/dashboard" } } as never })).toBe(false);
	});
});
