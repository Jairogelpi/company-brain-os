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

	it("creates an atomic batch with an evidence link for every assertion", async () => {
		const repo = createInMemoryAssertionRepository();
		await repo.createBatch([
			assertion,
			{ ...assertion, id: "a-2", predicate: "VALIDATES" },
		]);
		expect(new Set(await repo.listEvidenceAssertionIds("org-1")))
			.toEqual(new Set(["a-1", "a-2"]));

		await expect(repo.createBatch([
			{ ...assertion, id: "a-3" },
			{ ...assertion, id: "a-3", predicate: "VALIDATES" },
		])).rejects.toThrow(/already exists/);
		expect(await repo.get("a-3")).toBeUndefined();
	});
});
