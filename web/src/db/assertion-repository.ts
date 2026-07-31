import type { Assertion } from "@/domain/assertions";

export interface AssertionRepository {
	create(assertion: Assertion): Promise<void>;
	get(id: string): Promise<Assertion | undefined>;
	listByOrganization(organizationId: string): Promise<Assertion[]>;
	supersede(id: string, replacement: Assertion): Promise<Assertion>;
}

export function createInMemoryAssertionRepository(): AssertionRepository {
	const assertions = new Map<string, Assertion>();

	return {
		async create(assertion) {
			if (assertions.has(assertion.id)) throw new Error(`Assertion already exists: ${assertion.id}`);
			assertions.set(assertion.id, structuredClone(assertion));
		},
		async get(id) {
			const value = assertions.get(id);
			return value ? structuredClone(value) : undefined;
		},
		async listByOrganization(organizationId) {
			return [...assertions.values()]
				.filter((item) => item.organizationId === organizationId)
				.map((item) => structuredClone(item));
		},
		async supersede(id, replacement) {
			const current = assertions.get(id);
			if (!current) throw new Error(`Missing assertion: ${id}`);
			if (current.organizationId !== replacement.organizationId) throw new Error("Cannot cross organization boundaries");
			assertions.set(id, { ...current, status: "superseded", supersededBy: replacement.id });
			assertions.set(replacement.id, structuredClone({ ...replacement, status: "proposed" }));
			return structuredClone(assertions.get(replacement.id)!);
		},
	};
}
