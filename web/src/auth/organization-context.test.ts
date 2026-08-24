import { describe, expect, it } from "vitest";
import { requireOrganizationId } from "./organization-context";

describe("organization context", () => {
	it("returns an explicit organization id", () => {
		expect(requireOrganizationId("org-acme")).toBe("org-acme");
	});

	it("rejects missing organization context", () => {
		expect(() => requireOrganizationId(undefined)).toThrow("Organization context is required");
	});
});
