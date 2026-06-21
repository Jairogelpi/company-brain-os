import { describe, expect, it } from "vitest";
import {
	hasMinimumRole,
	canPerform,
	canValidate,
	guardOperation,
	type AuthUser,
} from "./permissions";

const owner: AuthUser = {
	id: "u1",
	name: "Owner",
	email: "o@c.com",
	companyId: "c1",
	role: "owner",
	validationDomains: ["*"],
};
const validator: AuthUser = {
	id: "u2",
	name: "Val",
	email: "v@c.com",
	companyId: "c1",
	role: "validator",
	validationDomains: ["producción"],
};
const contributor: AuthUser = {
	id: "u3",
	name: "Contrib",
	email: "c@c.com",
	companyId: "c1",
	role: "contributor",
	validationDomains: [],
};
const viewer: AuthUser = {
	id: "u4",
	name: "Viewer",
	email: "x@c.com",
	companyId: "c1",
	role: "viewer",
	validationDomains: [],
};

describe("Permissions", () => {
	describe("hasMinimumRole", () => {
		it("owner >= all roles", () => {
			expect(hasMinimumRole("owner", "owner")).toBe(true);
			expect(hasMinimumRole("owner", "validator")).toBe(true);
			expect(hasMinimumRole("owner", "contributor")).toBe(true);
			expect(hasMinimumRole("owner", "viewer")).toBe(true);
		});

		it("validator < owner", () => {
			expect(hasMinimumRole("validator", "owner")).toBe(false);
			expect(hasMinimumRole("validator", "validator")).toBe(true);
		});

		it("viewer < contributor", () => {
			expect(hasMinimumRole("viewer", "contributor")).toBe(false);
		});
	});

	describe("canPerform", () => {
		it("owner can delete nodes", () => {
			expect(canPerform(owner, "graph.node.delete")).toBe(true);
		});

		it("contributor cannot delete nodes", () => {
			expect(canPerform(contributor, "graph.node.delete")).toBe(false);
		});

		it("viewer cannot create or update anything", () => {
			expect(canPerform(viewer, "graph.node.create")).toBe(false);
			expect(canPerform(viewer, "graph.edge.create")).toBe(false);
			expect(canPerform(viewer, "mission.create")).toBe(false);
		});

		it("owner can invite users", () => {
			expect(canPerform(owner, "user.invite")).toBe(true);
		});

		it("validator cannot invite users", () => {
			expect(canPerform(validator, "user.invite")).toBe(false);
		});
	});

	describe("canValidate", () => {
		it("owner can validate any domain", () => {
			expect(canValidate(owner, "producción")).toBe(true);
			expect(canValidate(owner, "calidad")).toBe(true);
		});

		it("validator can only validate their assigned domains", () => {
			expect(canValidate(validator, "producción")).toBe(true);
			expect(canValidate(validator, "calidad")).toBe(false);
		});

		it("contributor cannot validate", () => {
			expect(canValidate(contributor, "producción")).toBe(false);
		});
	});

	describe("guardOperation", () => {
		it("returns null for allowed operation", () => {
			expect(guardOperation(owner, "graph.node.delete", "c1")).toBeNull();
		});

		it("returns forbidden for insufficient role", () => {
			const err = guardOperation(viewer, "graph.node.create", "c1");
			expect(err?.code).toBe("forbidden");
		});

		it("returns forbidden for cross-company access", () => {
			const err = guardOperation(owner, "graph.node.create", "c2");
			expect(err?.code).toBe("forbidden");
			expect(err?.message).toContain("c2");
		});

		it("returns unauthorized for null user", () => {
			const err = guardOperation(null, "graph.node.create");
			expect(err?.code).toBe("unauthorized");
		});
	});
});
