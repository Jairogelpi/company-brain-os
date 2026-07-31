import type { Assertion } from "@/domain/assertions";
import { requireOrganizationId } from "@/auth/organization-context";
import type { Db } from "./index";
import { assertions } from "./schema";
import { and, eq, sql } from "drizzle-orm";

export interface AssertionRepository {
	create(assertion: Assertion): Promise<void>;
	get(id: string): Promise<Assertion | undefined>;
	listByOrganization(organizationId: string): Promise<Assertion[]>;
	supersede(id: string, replacement: Assertion): Promise<Assertion>;
}

function toDate(value?: string): Date | null {
	return value ? new Date(value) : null;
}

function toRow(assertion: Assertion) {
	return {
		id: assertion.id,
		organizationId: assertion.organizationId,
		subjectEntityId: assertion.subjectEntityId,
		predicate: assertion.predicate,
		objectEntityId: assertion.objectEntityId ?? null,
		scalarValue: assertion.scalarValue ?? null,
		status: assertion.status,
		proposedBy: assertion.proposedBy,
		approvedBy: assertion.approvedBy ?? null,
		validFrom: toDate(assertion.validFrom),
		validUntil: toDate(assertion.validUntil),
		recordedAt: new Date(assertion.recordedAt),
		supersededBy: assertion.supersededBy ?? null,
		confidenceClass: assertion.confidenceClass,
		reviewDueAt: toDate(assertion.reviewDueAt),
		metadata: {
			...assertion.metadata,
			sourceType: assertion.sourceType,
			sourceId: assertion.sourceId,
		},
	};
}

function fromRow(row: typeof assertions.$inferSelect): Assertion {
	return {
		id: row.id,
		organizationId: row.organizationId,
		subjectEntityId: row.subjectEntityId,
		predicate: row.predicate,
		objectEntityId: row.objectEntityId ?? undefined,
		scalarValue: row.scalarValue as Assertion["scalarValue"],
		sourceType: String(row.metadata.sourceType ?? "ledger"),
		sourceId: String(row.metadata.sourceId ?? row.id),
		status: row.status,
		proposedBy: row.proposedBy,
		approvedBy: row.approvedBy ?? undefined,
		validFrom: row.validFrom?.toISOString(),
		validUntil: row.validUntil?.toISOString(),
		recordedAt: row.recordedAt.toISOString(),
		supersededBy: row.supersededBy ?? undefined,
		confidenceClass: row.confidenceClass,
		reviewDueAt: row.reviewDueAt?.toISOString(),
		metadata: row.metadata,
	};
}

/** A database-backed ledger scoped to exactly one organization. */
export function createDrizzleAssertionRepository(
	db: Db,
	organizationId: string,
): AssertionRepository {
	const tenantId = requireOrganizationId(organizationId);
	const scoped = (id: string) => and(eq(assertions.id, id), eq(assertions.organizationId, tenantId));
	const setTenant = (tx: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }) =>
		tx.execute(sql`select set_config('app.organization_id', ${tenantId}, true)`);

	return {
		async create(assertion) {
			if (assertion.organizationId !== tenantId) throw new Error("Cannot cross organization boundaries");
			await db.transaction(async (tx) => {
				await setTenant(tx);
				await tx.insert(assertions).values(toRow(assertion));
			});
		},
		async get(id) {
			const rows = await db.transaction(async (tx) => {
				await setTenant(tx);
				return tx.select().from(assertions).where(scoped(id)).limit(1);
			});
			return rows[0] ? fromRow(rows[0]) : undefined;
		},
		async listByOrganization(requestedOrganizationId) {
			if (requireOrganizationId(requestedOrganizationId) !== tenantId) return [];
			const rows = await db.transaction(async (tx) => {
				await setTenant(tx);
				return tx.select().from(assertions).where(eq(assertions.organizationId, tenantId));
			});
			return rows.map(fromRow);
		},
		async supersede(id, replacement) {
			if (replacement.organizationId !== tenantId) throw new Error("Cannot cross organization boundaries");
			await db.transaction(async (tx) => {
				await setTenant(tx);
				const current = await tx.select().from(assertions).where(scoped(id)).limit(1);
				if (!current[0]) throw new Error(`Missing assertion: ${id}`);
				await tx.update(assertions).set({ status: "superseded", supersededBy: replacement.id }).where(scoped(id));
				await tx.insert(assertions).values(toRow({ ...replacement, status: "proposed" }));
			});
			return { ...replacement, status: "proposed" };
		},
	};
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
