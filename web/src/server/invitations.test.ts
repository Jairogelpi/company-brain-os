import { describe, expect, it } from "vitest";
import { createInvitationToken, invitationCompanyId } from "./invitations";

describe("invitation tokens", () => {
	it("encodes the tenant without placing credentials in storage", () => {
		const token = createInvitationToken("acme-company");
		expect(invitationCompanyId(token)).toBe("acme-company");
		expect(token).not.toContain("acme-company");
		expect(token.split(".")[1]).toMatch(/^[A-Za-z0-9_-]{40,}$/);
	});

	it.each(["", "one-part", "a.short", "a.b.extra"])("rejects malformed token %s", (token) => {
		expect(() => invitationCompanyId(token)).toThrow(/Invalid invitation/);
	});
});
