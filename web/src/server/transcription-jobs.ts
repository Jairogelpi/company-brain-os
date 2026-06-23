import { and, asc, eq } from "drizzle-orm";
import { createDb, type Db } from "@/db";
import { transcriptionJobs } from "@/db/schema";
import type { TranscriptionProvider } from "@/ai/transcription";

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
	getJob(id: string): Promise<TranscriptionJob | undefined>;
	updateStatus(
		id: string,
		status: TranscriptionJobStatus,
		patch?: TranscriptionJobPatch,
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
				companyId: input.companyId ?? "default",
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
	return {
		async createJob(input) {
			const id = input.id ?? newJobId();
			const rows = await db
				.insert(transcriptionJobs)
				.values({ ...input, id })
				.returning();
			return rows[0];
		},

		async getJob(id) {
			const rows = await db
				.select()
				.from(transcriptionJobs)
				.where(eq(transcriptionJobs.id, id))
				.limit(1);
			return rows[0];
		},

		async updateStatus(id, status, patch = {}) {
			const rows = await db
				.update(transcriptionJobs)
				.set({ ...patch, status, updatedAt: now() })
				.where(eq(transcriptionJobs.id, id))
				.returning();
			if (!rows[0]) throw new Error(`Transcription job not found: ${id}`);
			return rows[0];
		},

		async claimQueued(limit = 1) {
			const queued = await db
				.select()
				.from(transcriptionJobs)
				.where(eq(transcriptionJobs.status, "queued"))
				.orderBy(asc(transcriptionJobs.createdAt))
				.limit(limit);
			const claimed: TranscriptionJob[] = [];
			for (const job of queued) {
				const rows = await db
					.update(transcriptionJobs)
					.set({ status: "processing", updatedAt: now() })
					.where(
						and(
							eq(transcriptionJobs.id, job.id),
							eq(transcriptionJobs.status, "queued"),
						),
					)
					.returning();
				if (rows[0]) claimed.push(rows[0]);
			}
			return claimed;
		},

		async reclaimProcessing() {
			const rows = await db
				.update(transcriptionJobs)
				.set({ status: "queued", updatedAt: now() })
				.where(eq(transcriptionJobs.status, "processing"))
				.returning({ id: transcriptionJobs.id });
			return rows.length;
		},
	};
}

export const defaultTranscriptionJobStore =
	createDrizzleTranscriptionJobStore();

export function createJob(input: CreateTranscriptionJobInput) {
	return defaultTranscriptionJobStore.createJob(input);
}

export function getJob(id: string) {
	return defaultTranscriptionJobStore.getJob(id);
}

export function updateStatus(
	id: string,
	status: TranscriptionJobStatus,
	patch?: TranscriptionJobPatch,
) {
	return defaultTranscriptionJobStore.updateStatus(id, status, patch);
}

export function claimQueued(limit?: number) {
	return defaultTranscriptionJobStore.claimQueued(limit);
}

export function reclaimProcessing() {
	return defaultTranscriptionJobStore.reclaimProcessing();
}
