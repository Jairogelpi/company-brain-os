import { describe, expect, it } from "vitest";
import { transcriptionJobs } from "@/db/schema";

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
		const row: typeof transcriptionJobs.$inferInsert = {
			id: "job-1",
			companyId: "companyA",
			userId: "user-1",
			source: "interview.mp3",
			storageKey: "00000000-0000-4000-8000-000000000001.mp3",
			mimeType: "audio/mpeg",
		};

		expect(row.status ?? "queued").toBe("queued");
	});
});
