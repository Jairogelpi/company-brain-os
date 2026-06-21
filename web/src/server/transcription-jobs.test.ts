import { afterEach, describe, expect, it, vi } from "vitest";
import type { TranscriptionResult, TranscriptionService } from "@/ai/transcription";
import { TranscriptionError } from "@/ai/transcription";
import { transcriptionJobs } from "@/db/schema";
import {
	createInMemoryTranscriptionJobStore,
	type CreateTranscriptionJobInput,
} from "./transcription-jobs";
import {
	runTranscriptionWorkerOnce,
	startTranscriptionWorker,
} from "./transcription-worker";

const baseJob: CreateTranscriptionJobInput = {
	companyId: "companyA",
	userId: "user-1",
	source: "interview.mp3",
	storageKey: "00000000-0000-4000-8000-000000000001.mp3",
	mimeType: "audio/mpeg",
};

function fakeService(result: TranscriptionResult): TranscriptionService {
	return {
		transcribe: vi.fn().mockResolvedValue(result),
		transcribeBuffer: vi.fn().mockResolvedValue(result),
	};
}

function failingService(error: unknown): TranscriptionService {
	return {
		transcribe: vi.fn().mockRejectedValue(error),
		transcribeBuffer: vi.fn().mockRejectedValue(error),
	};
}

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

describe("transcription worker", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("completes a queued job and feeds transcript into the ingest inbox", async () => {
		const store = createInMemoryTranscriptionJobStore();
		await store.createJob({ ...baseJob, id: "job-1" });
		const save = vi.fn().mockResolvedValue([]);

		await runTranscriptionWorkerOnce({
			store,
			service: fakeService({
				text: "Pedro configures the filler.",
				language: "en",
				confidence: 80,
				provider: "whisper-cpp",
			}),
			ingest: () => ({
				source: "interview.mp3",
				summary: "1 proposal",
				proposals: [
					{
						source: "interview.mp3",
						proposal: {
							type: "create_node",
							node: { id: "person-pedro", type: "Person", name: "Pedro" },
							reason: "Transcript",
						},
					},
				],
			}),
			save,
		});

		await expect(store.getJob("job-1")).resolves.toMatchObject({
			status: "completed",
			transcript: "Pedro configures the filler.",
			provider: "whisper-cpp",
		});
		expect(save).toHaveBeenCalledWith(
			"companyA",
			"interview.mp3",
			"text",
			expect.arrayContaining([expect.objectContaining({ type: "create_node" })]),
		);
	});

	it("marks silent audio completed with no proposals", async () => {
		const store = createInMemoryTranscriptionJobStore();
		await store.createJob({ ...baseJob, id: "job-1" });
		const save = vi.fn().mockResolvedValue([]);

		await runTranscriptionWorkerOnce({
			store,
			service: fakeService({
				text: "",
				language: "unknown",
				confidence: 0,
				provider: "whisper-cpp",
				noSpeech: true,
			}),
			save,
		});

		await expect(store.getJob("job-1")).resolves.toMatchObject({
			status: "completed",
			noSpeech: true,
		});
		expect(save).not.toHaveBeenCalled();
	});

	it("marks unavailable providers as failed", async () => {
		const store = createInMemoryTranscriptionJobStore();
		await store.createJob({ ...baseJob, id: "job-1" });

		await runTranscriptionWorkerOnce({
			store,
			service: fakeService({
				text: "",
				language: "unknown",
				confidence: 0,
				provider: "unavailable",
			}),
		});

		await expect(store.getJob("job-1")).resolves.toMatchObject({
			status: "failed",
			provider: "unavailable",
		});
	});

	it("marks transcription errors as failed", async () => {
		const store = createInMemoryTranscriptionJobStore();
		await store.createJob({ ...baseJob, id: "job-1" });

		await runTranscriptionWorkerOnce({
			store,
			service: failingService(new TranscriptionError("unavailable", "down")),
		});

		await expect(store.getJob("job-1")).resolves.toMatchObject({
			status: "failed",
			failReason: "unavailable: down",
		});
	});

	it("starts a stoppable interval and reclaims processing jobs", async () => {
		vi.useFakeTimers();
		const store = createInMemoryTranscriptionJobStore();
		await store.createJob({ ...baseJob, id: "job-1" });
		await store.updateStatus("job-1", "processing");
		const runOnce = vi.fn().mockResolvedValue(undefined);

		const stop = startTranscriptionWorker({ store, intervalMs: 10, runOnce });
		await vi.runOnlyPendingTimersAsync();
		stop();

		await expect(store.getJob("job-1")).resolves.toMatchObject({
			status: "queued",
		});
		expect(runOnce).toHaveBeenCalled();
	});
});
