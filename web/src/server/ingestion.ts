import { and, eq, inArray } from "drizzle-orm";
import { createDb } from "@/db";
import { ingestionItems } from "@/db/schema";
import type { GraphOperationProposal } from "@/domain/interview";

/** Durable inbox queue + ingest audit trail, scoped to a company (tenant). */

export type PendingItem = {
	id: string;
	source: string;
	kind: "csv" | "text";
	proposal: GraphOperationProposal;
};

export async function savePending(
	companyId: string,
	source: string,
	kind: "csv" | "text",
	proposals: GraphOperationProposal[],
): Promise<PendingItem[]> {
	const rows = proposals.map((proposal) => ({
		id: `ing-${globalThis.crypto.randomUUID()}`,
		companyId,
		source,
		kind,
		proposal: proposal as unknown as Record<string, unknown>,
		status: "pending" as const,
	}));
	if (rows.length > 0) {
		await createDb().insert(ingestionItems).values(rows);
	}
	return rows.map((r) => ({
		id: r.id,
		source: r.source,
		kind: r.kind,
		proposal: r.proposal as unknown as GraphOperationProposal,
	}));
}

export async function listPending(companyId: string): Promise<PendingItem[]> {
	const rows = await createDb()
		.select()
		.from(ingestionItems)
		.where(
			and(
				eq(ingestionItems.companyId, companyId),
				eq(ingestionItems.status, "pending"),
			),
		)
		.orderBy(ingestionItems.createdAt);
	return rows.map((r) => ({
		id: r.id,
		source: r.source,
		kind: r.kind,
		proposal: r.proposal as unknown as GraphOperationProposal,
	}));
}

export async function countPending(companyId: string): Promise<number> {
	return (await listPending(companyId)).length;
}

export async function getPendingByIds(
	companyId: string,
	ids: string[],
): Promise<PendingItem[]> {
	if (ids.length === 0) return [];
	const rows = await createDb()
		.select()
		.from(ingestionItems)
		.where(
			and(
				eq(ingestionItems.companyId, companyId),
				eq(ingestionItems.status, "pending"),
				inArray(ingestionItems.id, ids),
			),
		);
	return rows.map((r) => ({
		id: r.id,
		source: r.source,
		kind: r.kind,
		proposal: r.proposal as unknown as GraphOperationProposal,
	}));
}

export async function markReviewed(
	companyId: string,
	ids: string[],
	status: "approved" | "rejected",
): Promise<void> {
	if (ids.length === 0) return;
	await createDb()
		.update(ingestionItems)
		.set({ status, reviewedAt: new Date() })
		.where(
			and(
				eq(ingestionItems.companyId, companyId),
				inArray(ingestionItems.id, ids),
			),
		);
}
