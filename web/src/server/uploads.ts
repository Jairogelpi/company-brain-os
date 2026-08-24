import { and, eq, gt, lte } from "drizzle-orm";
import { createDb, type Db } from "@/db";
import { companies, storedUploads } from "@/db/schema";
import { withTenantTransaction } from "@/db/tenant-transaction";
import { getStorage, type StorageAdapter } from "@/lib/storage";
import { tenantStorageKey } from "@/lib/upload-security";

export async function registerStoredUpload(input: {
	id: string;
	companyId: string;
	filename: string;
	originalName: string;
	mimeType: string;
	sizeBytes: number;
	contentSha256: string;
	uploadedBy: string;
	scanProvider: string;
	retentionUntil: Date;
}): Promise<void> {
	const db = createDb();
	await withTenantTransaction(db, input.companyId, (tx) => tx.insert(storedUploads).values({
		...input,
		status: "available",
	}));
}

export async function isStoredUploadAvailable(
	companyId: string,
	filename: string,
): Promise<boolean> {
	const db = createDb();
	const rows = await withTenantTransaction(db, companyId, (tx) => tx.select({ id: storedUploads.id })
		.from(storedUploads)
		.where(and(
			eq(storedUploads.companyId, companyId),
			eq(storedUploads.filename, filename),
			eq(storedUploads.status, "available"),
			gt(storedUploads.retentionUntil, new Date()),
		))
		.limit(1));
	return rows.length === 1;
}

/** Delete expired objects first, then retain their metadata as expired audit rows. */
export async function cleanupExpiredUploads(
	limit = 100,
	db: Db = createDb(),
	storage: StorageAdapter = getStorage(),
	now = new Date(),
): Promise<{ deleted: number; failed: number }> {
	const companyRows = await db.select({ id: companies.id }).from(companies);
	let deleted = 0;
	let failed = 0;
	for (const company of companyRows) {
		if (deleted + failed >= limit) break;
		const candidates = await withTenantTransaction(db, company.id, (tx) => tx
			.select({ id: storedUploads.id, filename: storedUploads.filename })
			.from(storedUploads)
			.where(and(
				eq(storedUploads.companyId, company.id),
				eq(storedUploads.status, "available"),
				lte(storedUploads.retentionUntil, now),
			))
			.limit(limit - deleted - failed));
		for (const candidate of candidates) {
			try {
				await storage.delete(tenantStorageKey(company.id, candidate.filename));
				await withTenantTransaction(db, company.id, (tx) => tx
					.update(storedUploads)
					.set({ status: "expired" })
					.where(and(
						eq(storedUploads.companyId, company.id),
						eq(storedUploads.id, candidate.id),
						eq(storedUploads.status, "available"),
					)));
				deleted += 1;
			} catch {
				// The row remains unavailable because retention is past, and the
				// next worker pass retries the idempotent object delete.
				failed += 1;
			}
		}
	}
	return { deleted, failed };
}
