import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth/api-guard", () => ({ requireApiUser: vi.fn() }));
vi.mock("@/server/graph", () => ({ getGraphService: vi.fn() }));

const { patchRequiresValidation } = await import("@/auth/graph-field-permissions");

describe("graph node control fields", () => {
	it.each(["criticality", "knowledgeType", "documented", "validationState", "confidence"])(
		"requires validator authority for %s",
		(field) => expect(patchRequiresValidation({ [field]: true })).toBe(true),
	);

	it("allows contributor-safe display and cost fields through this gate", () => {
		expect(patchRequiresValidation({ name: "Filler", x: 10 })).toBe(false);
	});
});
