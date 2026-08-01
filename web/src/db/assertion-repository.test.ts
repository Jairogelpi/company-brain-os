import { describe, expect, it } from "vitest";
import { createInMemoryAssertionRepository } from "./assertion-repository";
import type { Assertion } from "@/domain/assertions";

const assertion: Assertion = {
	id: "a-1", organizationId: "org-1", subjectEntityId: "pedro", predicate: "MASTERS",
	objectEntityId: "line-config", sourceType: "interview", sourceId: "answer-1",
	status: "proposed", proposedBy: "owner", recordedAt: "2026-07-31T00:00:00.000Z",
	confidenceClass: "supported", metadata: {},
};

describe("assertion repository", () => {
	it("stores assertions only within their organization", async () => {
		const repo = createInMemoryAssertionRepository();
		await repo.create(assertion);

		expect(await repo.listByOrganization("org-1")).toEqual([assertion]);
		expect(await repo.listByOrganization("org-2")).toEqual([]);
	});

	it("supersedes approved assertions instead of mutating them", async () => {
		const repo = createInMemoryAssertionRepository();
		await repo.create({ ...assertion, status: "approved", approvedBy: "validator" });
		const replacement = await repo.supersede("a-1", { ...assertion, id: "a-2", scalarValue: 4 });

		expect(replacement.status).toBe("proposed");
		expect((await repo.get("a-1"))?.status).toBe("superseded");
	});

	it("rejects assertions without canonical provenance", async () => {
		const repo = createInMemoryAssertionRepository();

		await expect(repo.create({ ...assertion, id: "missing-source", sourceId: "" })).rejects.toThrow(
			"missing_provenance",
		);
	});
});
