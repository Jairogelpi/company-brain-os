import {
	assertionCanTransition,
	validateAssertion,
	type Assertion,
	type AssertionStatus,
} from "@/domain/assertions";
import { requireOrganizationId } from "@/auth/organization-context";
import type { Db } from "./index";
import {
	assertionEvidence,
	assertions,
	evidenceItems,
	evidenceSources,
} from "./schema";
import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";

export interface AssertionRepository {
	create(assertion: Assertion): Promise<void>;
	createBatch(assertions: Assertion[]): Promise<void>;
	get(id: string): Promise<Assertion | undefined>;
	listByOrganization(organizationId: string): Promise<Assertion[]>;
	supersede(id: string, replacement: Assertion): Promise<Assertion>;
	transition(id: string, status: AssertionStatus, actorId: string): Promise<Assertion>;
	listEvidenceAssertionIds(organizationId: string): Promise<string[]>;
}

function assertValid(assertion: Assertion): void {
	const issues = validateAssertion(assertion);
	if (issues.length > 0) {
		throw new Error(`Invalid assertion: ${issues.map((issue) => issue.code).join(", ")}`);
	}
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
		sourceType: assertion.sourceType,
		sourceId: assertion.sourceId,
		status: assertion.status,
		proposedBy: assertion.proposedBy,
		approvedBy: assertion.approvedBy ?? null,
		validFrom: toDate(assertion.validFrom),
		validUntil: toDate(assertion.validUntil),
		recordedAt: new Date(assertion.recordedAt),
		supersededBy: assertion.supersededBy ?? null,
		confidenceClass: assertion.confidenceClass,
		reviewDueAt: toDate(assertion.reviewDueAt),
		metadata: assertion.metadata,
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
		sourceType: row.sourceType,
		sourceId: row.sourceId,
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

function evidenceIdentity(assertion: Assertion) {
	const digest = createHash("sha256")
		.update(`${assertion.organizationId}\0${assertion.sourceType}\0${assertion.sourceId}`)
		.digest("hex");
	return {
		sourceId: `source-${digest}`,
		itemId: `evidence-${digest}`,
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
	async function insertEvidence(
		tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
		batch: Assertion[],
	) {
		const groups = new Map<string, { sourceId: string; itemId: string; assertions: Assertion[] }>();
		for (const assertion of batch) {
			const identity = evidenceIdentity(assertion);
			const group = groups.get(identity.itemId) ?? { ...identity, assertions: [] };
			group.assertions.push(assertion);
			groups.set(identity.itemId, group);
		}
		for (const group of groups.values()) {
			const first = group.assertions[0];
			await tx.insert(evidenceSources).values({
				id: group.sourceId,
				organizationId: tenantId,
				type: first.sourceType,
				createdBy: first.proposedBy,
			}).onConflictDoNothing();
			await tx.insert(evidenceItems).values({
				id: group.itemId,
				organizationId: tenantId,
				sourceId: group.sourceId,
				contentHash: typeof first.metadata.contentHash === "string"
					? first.metadata.contentHash
					: null,
				metadata: {
					sourceType: first.sourceType,
					sourceId: first.sourceId,
				},
			}).onConflictDoNothing();
			await tx.insert(assertionEvidence).values(group.assertions.map((assertion) => ({
				id: `link-${createHash("sha256").update(`${assertion.id}\0${group.itemId}`).digest("hex")}`,
				organizationId: tenantId,
				assertionId: assertion.id,
				evidenceItemId: group.itemId,
			}))).onConflictDoNothing();
		}
	}

	async function createBatch(batch: Assertion[]): Promise<void> {
		if (batch.length === 0) return;
		for (const assertion of batch) {
			assertValid(assertion);
			if (assertion.organizationId !== tenantId) throw new Error("Cannot cross organization boundaries");
		}
		await db.transaction(async (tx) => {
			await setTenant(tx);
			await tx.insert(assertions).values(batch.map(toRow));
			await insertEvidence(tx, batch);
		});
	}

	return {
		async create(assertion) {
			await createBatch([assertion]);
		},
		createBatch,
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
			assertValid({ ...replacement, status: "proposed", approvedBy: undefined });
			if (replacement.organizationId !== tenantId) throw new Error("Cannot cross organization boundaries");
			await db.transaction(async (tx) => {
				await setTenant(tx);
				const current = await tx.select().from(assertions).where(scoped(id)).limit(1);
				if (!current[0]) throw new Error(`Missing assertion: ${id}`);
				await tx.update(assertions).set({ status: "superseded", supersededBy: replacement.id }).where(scoped(id));
				const proposed = { ...replacement, status: "proposed" as const };
				await tx.insert(assertions).values(toRow(proposed));
				await insertEvidence(tx, [proposed]);
			});
			return { ...replacement, status: "proposed" };
		},
		async transition(id, status, actorId) {
			const updated = await db.transaction(async (tx) => {
				await setTenant(tx);
				const current = await tx.select().from(assertions).where(scoped(id)).limit(1);
				if (!current[0]) throw new Error(`Missing assertion: ${id}`);
				if (!assertionCanTransition(current[0].status, status)) {
					throw new Error(`Invalid assertion transition: ${current[0].status} -> ${status}`);
				}
				const approvedBy = status === "approved" ? actorId : current[0].approvedBy;
				const rows = await tx.update(assertions)
					.set({ status, approvedBy })
					.where(scoped(id))
					.returning();
				return rows[0];
			});
			if (!updated) throw new Error(`Missing assertion: ${id}`);
			return fromRow(updated);
		},
		async listEvidenceAssertionIds(requestedOrganizationId) {
			if (requireOrganizationId(requestedOrganizationId) !== tenantId) return [];
			const rows = await db.transaction(async (tx) => {
				await setTenant(tx);
				return tx.select({ id: assertionEvidence.assertionId })
					.from(assertionEvidence)
					.where(eq(assertionEvidence.organizationId, tenantId));
			});
			return rows.map((row) => row.id);
		},
	};
}

export function createInMemoryAssertionRepository(): AssertionRepository {
	const assertions = new Map<string, Assertion>();
	const evidenceAssertionIds = new Set<string>();

	async function createBatch(batch: Assertion[]): Promise<void> {
		const batchIds = new Set<string>();
		for (const assertion of batch) {
			assertValid(assertion);
			if (assertions.has(assertion.id) || batchIds.has(assertion.id)) {
				throw new Error(`Assertion already exists: ${assertion.id}`);
			}
			batchIds.add(assertion.id);
		}
		for (const assertion of batch) {
			assertions.set(assertion.id, structuredClone(assertion));
			evidenceAssertionIds.add(assertion.id);
		}
	}

	return {
		async create(assertion) {
			await createBatch([assertion]);
		},
		createBatch,
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
			assertValid({ ...replacement, status: "proposed", approvedBy: undefined });
			const current = assertions.get(id);
			if (!current) throw new Error(`Missing assertion: ${id}`);
			if (current.organizationId !== replacement.organizationId) throw new Error("Cannot cross organization boundaries");
			assertions.set(id, { ...current, status: "superseded", supersededBy: replacement.id });
			assertions.set(replacement.id, structuredClone({ ...replacement, status: "proposed" }));
			evidenceAssertionIds.add(replacement.id);
			return structuredClone(assertions.get(replacement.id)!);
		},
		async transition(id, status, actorId) {
			const current = assertions.get(id);
			if (!current) throw new Error(`Missing assertion: ${id}`);
			if (!assertionCanTransition(current.status, status)) {
				throw new Error(`Invalid assertion transition: ${current.status} -> ${status}`);
			}
			const updated: Assertion = {
				...current,
				status,
				approvedBy: status === "approved" ? actorId : current.approvedBy,
			};
			assertions.set(id, updated);
			return structuredClone(updated);
		},
		async listEvidenceAssertionIds(organizationId) {
			return [...evidenceAssertionIds].filter(
				(id) => assertions.get(id)?.organizationId === organizationId,
			);
		},
	};
}
