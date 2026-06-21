import { describe, expect, it } from "vitest";
import { CompanySlugConflictError, createCompany } from "./company-service";

describe("company-service", () => {
	it("rejects empty company slugs instead of silently overwriting", () => {
		expect(() => createCompany("!!!")).toThrow(/non-empty slug/i);
	});

	it("rejects slug collisions with a typed error", () => {
		const first = createCompany("Acme Corp!");

		expect(() => createCompany("Acme  Corp")).toThrow(CompanySlugConflictError);
		expect(first.slug).toBe("acme-corp");
	});
});
