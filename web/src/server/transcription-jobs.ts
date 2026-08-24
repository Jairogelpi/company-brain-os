import { and, asc, eq } from "drizzle-orm";
import { createDb, type Db } from "@/db";
import { companies, transcriptionJobs } from "@/db/schema";
import type { TranscriptionProvider } from "@/ai/transcription";
import { requireOrganizationId } from "@/auth/organization-context";
import { withTenantTransaction } from "@/db/tenant-transaction";

export type TranscriptionJobStatus =
	| "queued"
	| "processing"
	| "completed"
	| "failed";

export type TranscriptionJob = typeof transcriptionJobs.$inferSelect;

export type CreateTranscriptionJobInput = Omit<
	typeof transcriptionJobs.$inferInsert,
	"id" | "status" | "createdAt" | "updatedAt"
> & {
	id?: string;
};

export type TranscriptionJobPatch = Partial<{
	transcript: string | null;
	noSpeech: boolean;
	failReason: string | null;
	provider: TranscriptionProvider | null;
	durationSeconds: number | null;
}>;

export interface TranscriptionJobStore {
	createJob(input: CreateTranscriptionJobInput): Promise<TranscriptionJob>;
	getJob(id: string, companyId?: string): Promise<TranscriptionJob | undefined>;
	updateStatus(
		id: string,
		status: TranscriptionJobStatus,
		patch?: TranscriptionJobPatch,
		companyId?: string,
	): Promise<TranscriptionJob>;
	claimQueued(limit?: number): Promise<TranscriptionJob[]>;
	reclaimProcessing(): Promise<number>;
}

function now(): Date {
	return new Date();
}

function newJobId(): string {
	return `tr-${globalThis.crypto.randomUUID()}`;
}

function byCreatedAt(a: TranscriptionJob, b: TranscriptionJob): number {
	return a.createdAt.getTime() - b.createdAt.getTime();
}

export function createInMemoryTranscriptionJobStore(
	initial: TranscriptionJob[] = [],
): TranscriptionJobStore {
	const rows = new Map<string, TranscriptionJob>(initial.map((j) => [j.id, j]));

	return {
		async createJob(input) {
			const timestamp = now();
			const job: TranscriptionJob = {
				id: input.id ?? newJobId(),
				companyId: requireOrganizationId(input.companyId),
				userId: input.userId,
				source: input.source,
				storageKey: input.storageKey,
				mimeType: input.mimeType,
				status: "queued",
				transcript: input.transcript ?? null,
				noSpeech: input.noSpeech ?? false,
				failReason: input.failReason ?? null,
				provider: input.provider ?? null,
				durationSeconds: input.durationSeconds ?? null,
				createdAt: timestamp,
				updatedAt: timestamp,
			};
			rows.set(job.id, job);
			return job;
		},

		async getJob(id) {
			return rows.get(id);
		},

		async updateStatus(id, status, patch = {}) {
			const current = rows.get(id);
			if (!current) throw new Error(`Transcription job not found: ${id}`);
			const updated: TranscriptionJob = {
				...current,
				...patch,
				status,
				updatedAt: now(),
			};
			rows.set(id, updated);
			return updated;
		},

		async claimQueued(limit = 1) {
			const claimed = [...rows.values()]
				.filter((j) => j.status === "queued")
				.sort(byCreatedAt)
				.slice(0, limit);
			return Promise.all(
				claimed.map((j) => this.updateStatus(j.id, "processing")),
			);
		},

		async reclaimProcessing() {
			const processing = [...rows.values()].filter(
				(j) => j.status === "processing",
			);
			await Promise.all(
				processing.map((j) => this.updateStatus(j.id, "queued")),
			);
			return processing.length;
		},
	};
}

export function createDrizzleTranscriptionJobStore(
	db: Db = createDb(),
): TranscriptionJobStore {
	async function tenantIds(companyId?: string): Promise<string[]> {
		if (companyId) return [requireOrganizationId(companyId)];
		return (await db.select({ id: companies.id }).from(companies)).map((row) => row.id);
	}

	return {
		async createJob(input) {
			const id = input.id ?? newJobId();
			const companyId = requireOrganizationId(input.companyId);
			const rows = await withTenantTransaction(db, companyId, (tx) => tx
				.insert(transcriptionJobs)
				.values({ ...input, companyId, id })
				.returning());
			return rows[0];
		},

		async getJob(id, companyId) {
			for (const tenantId of await tenantIds(companyId)) {
				const rows = await withTenantTransaction(db, tenantId, (tx) => tx
					.select()
					.from(transcriptionJobs)
					.where(and(
						eq(transcriptionJobs.companyId, tenantId),
						eq(transcriptionJobs.id, id),
					))
					.limit(1));
				if (rows[0]) return rows[0];
			}
			return undefined;
		},

		async updateStatus(id, status, patch = {}, companyId) {
			for (const tenantId of await tenantIds(companyId)) {
				const rows = await withTenantTransaction(db, tenantId, (tx) => tx
					.update(transcriptionJobs)
					.set({ ...patch, status, updatedAt: now() })
					.where(and(
						eq(transcriptionJobs.companyId, tenantId),
						eq(transcriptionJobs.id, id),
					))
					.returning());
				if (rows[0]) return rows[0];
			}
			throw new Error(`Transcription job not found: ${id}`);
		},

		async claimQueued(limit = 1) {
			const claimed: TranscriptionJob[] = [];
			for (const tenantId of await tenantIds()) {
				if (claimed.length >= limit) break;
				const rows = await withTenantTransaction(db, tenantId, async (tx) => {
					const queued = await tx
						.select()
						.from(transcriptionJobs)
						.where(and(
							eq(transcriptionJobs.companyId, tenantId),
							eq(transcriptionJobs.status, "queued"),
						))
						.orderBy(asc(transcriptionJobs.createdAt))
						.limit(limit - claimed.length);
					const tenantClaimed: TranscriptionJob[] = [];
					for (const job of queued) {
						const updated = await tx
							.update(transcriptionJobs)
							.set({ status: "processing", updatedAt: now() })
							.where(and(
								eq(transcriptionJobs.companyId, tenantId),
								eq(transcriptionJobs.id, job.id),
								eq(transcriptionJobs.status, "queued"),
							))
							.returning();
						if (updated[0]) tenantClaimed.push(updated[0]);
					}
					return tenantClaimed;
				});
				claimed.push(...rows);
			}
			return claimed;
		},

		async reclaimProcessing() {
			let count = 0;
			for (const tenantId of await tenantIds()) {
				const rows = await withTenantTransaction(db, tenantId, (tx) => tx
					.update(transcriptionJobs)
					.set({ status: "queued", updatedAt: now() })
					.where(and(
						eq(transcriptionJobs.companyId, tenantId),
						eq(transcriptionJobs.status, "processing"),
					))
					.returning({ id: transcriptionJobs.id }));
				count += rows.length;
			}
			return count;
		},
	};
}

let cachedDefaultStore: TranscriptionJobStore | undefined;

function resolveDefaultStore(): TranscriptionJobStore {
	return (cachedDefaultStore ??= createDrizzleTranscriptionJobStore());
}

/**
 * Default DB-backed store. The Drizzle/pg connection is created lazily on
 * first use (not at import) so `next build` can collect page data without a
 * DATABASE_URL — the connection is only resolved when a handler actually runs.
 */
export const defaultTranscriptionJobStore: TranscriptionJobStore = {
	createJob: (input) => resolveDefaultStore().createJob(input),
	getJob: (id, companyId) => resolveDefaultStore().getJob(id, companyId),
	updateStatus: (id, status, patch, companyId) =>
		resolveDefaultStore().updateStatus(id, status, patch, companyId),
	claimQueued: (limit) => resolveDefaultStore().claimQueued(limit),
	reclaimProcessing: () => resolveDefaultStore().reclaimProcessing(),
};

export function createJob(input: CreateTranscriptionJobInput) {
	return defaultTranscriptionJobStore.createJob(input);
}

export function getJob(id: string, companyId?: string) {
	return defaultTranscriptionJobStore.getJob(id, companyId);
}

export function updateStatus(
	id: string,
	status: TranscriptionJobStatus,
	patch?: TranscriptionJobPatch,
	companyId?: string,
) {
	return defaultTranscriptionJobStore.updateStatus(id, status, patch, companyId);
}

export function claimQueued(limit?: number) {
	return defaultTranscriptionJobStore.claimQueued(limit);
}

export function reclaimProcessing() {
	return defaultTranscriptionJobStore.reclaimProcessing();
}
