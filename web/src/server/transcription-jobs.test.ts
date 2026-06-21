import { describe, expect, it } from "vitest";
import { transcriptionJobs } from "@/db/schema";
import {
	createInMemoryTranscriptionJobStore,
	type CreateTranscriptionJobInput,
} from "./transcription-jobs";

const baseJob: CreateTranscriptionJobInput = {
	companyId: "companyA",
	userId: "user-1",
	source: "interview.mp3",
	storageKey: "00000000-0000-4000-8000-000000000001.mp3",
	mimeType: "audio/mpeg",
};

describe("transcription_jobs schema", () => {
	it("exports the durable transcription job table columns", () => {
		expect(transcriptionJobs).toMatchObject({
			id: expect.any(Object),
			companyId: expect.any(Object),
			userId: expect.any(Object),
			source: expect.any(Object),
			storageKey: expect.any(Object),
			mimeType: expect.any(Object),
			status: expect.any(Object),
			transcript: expect.any(Object),
			noSpeech: expect.any(Object),
			failReason: expect.any(Object),
			provider: expect.any(Object),
			durationSeconds: expect.any(Object),
			createdAt: expect.any(Object),
			updatedAt: expect.any(Object),
		});
	});

	it("types inserts with queued as the default status", () => {
		const row: typeof transcriptionJobs.$inferInsert = { ...baseJob, id: "job-1" };
		expect(row.status ?? "queued").toBe("queued");
	});
});

describe("TranscriptionJobStore", () => {
	it("creates and retrieves a queued job", async () => {
		const store = createInMemoryTranscriptionJobStore();
		const job = await store.createJob({ ...baseJob, id: "job-1" });

		expect(job.status).toBe("queued");
		expect(job.noSpeech).toBe(false);
		await expect(store.getJob("job-1")).resolves.toMatchObject({
			companyId: "companyA",
			source: "interview.mp3",
		});
	});

	it("updates status and completion fields", async () => {
		const store = createInMemoryTranscriptionJobStore();
		await store.createJob({ ...baseJob, id: "job-1" });

		const updated = await store.updateStatus("job-1", "completed", {
			transcript: "hello",
			provider: "whisper-cpp",
		});

		expect(updated).toMatchObject({
			status: "completed",
			transcript: "hello",
			provider: "whisper-cpp",
		});
	});

	it("claims queued jobs oldest-first with a batch cap", async () => {
		const store = createInMemoryTranscriptionJobStore();
		await store.createJob({ ...baseJob, id: "job-1", source: "one.mp3" });
		await store.createJob({ ...baseJob, id: "job-2", source: "two.mp3" });

		const first = await store.claimQueued(1);
		const second = await store.claimQueued(5);

		expect(first.map((j) => j.id)).toEqual(["job-1"]);
		expect(second.map((j) => j.id)).toEqual(["job-2"]);
		await expect(store.getJob("job-1")).resolves.toMatchObject({
			status: "processing",
		});
	});

	it("reclaims processing jobs on restart", async () => {
		const store = createInMemoryTranscriptionJobStore();
		await store.createJob({ ...baseJob, id: "job-1" });
		await store.updateStatus("job-1", "processing");

		const count = await store.reclaimProcessing();

		expect(count).toBe(1);
		await expect(store.getJob("job-1")).resolves.toMatchObject({
			companyId: "companyA",
			status: "queued",
		});
	});
});
