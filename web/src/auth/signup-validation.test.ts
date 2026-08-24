import { describe, expect, it } from "vitest";
import { validateSignup } from "./signup-validation";

const validBody = {
	email: "owner@example.com",
	password: "correct-horse-battery",
	companyName: "Acme Corp",
	slug: "acme-corp",
};

describe("validateSignup", () => {
	it("accepts a valid signup body", () => {
		expect(validateSignup(validBody)).toBeNull();
	});

	it.each([
		["email", { ...validBody, email: "not-an-email" }],
		["password", { ...validBody, password: "1234567" }],
		["password", { ...validBody, password: "x".repeat(129) }],
		["companyName", { ...validBody, companyName: "   " }],
		["slug", { ...validBody, slug: "Acme Co!" }],
		["slug", { ...validBody, slug: "-acme" }],
		["slug", { ...validBody, slug: "a" }],
	])("rejects invalid %s", (field, body) => {
		expect(validateSignup(body)).toEqual({ field });
	});

	it("normalizes a valid signup body", async () => {
		const result = validateSignup({
			...validBody,
			email: "  Owner@Example.COM ",
			companyName: "  Acme Corp  ",
		});

		expect(result).toBeNull();
	});
});
