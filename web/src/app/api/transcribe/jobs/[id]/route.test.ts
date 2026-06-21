import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type { TranscriptionJob } from "@/server/transcription-jobs";

const requireApiUserMock = vi.fn();
const getJobMock = vi.fn();

vi.mock("@/auth/api-guard", () => ({ requireApiUser: requireApiUserMock }));
vi.mock("@/server/transcription-jobs", () => ({ getJob: getJobMock }));

const { GET } = await import("./route");

function authedUser(companyId = "companyA") {
	return {
		id: "user-1",
		companyId,
		role: "contributor" as const,
		name: "Test",
		email: "t@example.com",
		validationDomains: [] as string[],
	};
}

function job(overrides: Partial<TranscriptionJob> = {}): TranscriptionJob {
	const now = new Date("2026-01-01T00:00:00.000Z");
	return {
		id: "job-1",
		companyId: "companyA",
		userId: "user-1",
		source: "interview.mp3",
		storageKey: "00000000-0000-4000-8000-000000000001.mp3",
		mimeType: "audio/mpeg",
		status: "queued",
		transcript: null,
		noSpeech: false,
		failReason: null,
		provider: null,
		durationSeconds: null,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

async function call(id = "job-1") {
	const res = await GET(new Request(`http://localhost/api/transcribe/jobs/${id}`), {
		params: Promise.resolve({ id }),
	});
	return { status: res.status, json: await res.json() };
}

describe("GET /api/transcribe/jobs/:id", () => {
	beforeEach(() => {
		requireApiUserMock.mockReset().mockResolvedValue(authedUser());
		getJobMock.mockReset().mockResolvedValue(job());
	});

	it("returns 401 when unauthenticated", async () => {
		requireApiUserMock.mockResolvedValue(
			NextResponse.json({ error: "Authentication required." }, { status: 401 }),
		);

		const { status } = await call();

		expect(status).toBe(401);
	});

	it("returns 404 for missing jobs", async () => {
		getJobMock.mockResolvedValue(undefined);

		const { status } = await call();

		expect(status).toBe(404);
	});

	it("returns 404 across tenant boundaries", async () => {
		requireApiUserMock.mockResolvedValue(authedUser("companyB"));

		const { status } = await call();

		expect(status).toBe(404);
	});

	it("returns queued status without transcript", async () => {
		const { status, json } = await call();

		expect(status).toBe(200);
		expect(json).toEqual({
			id: "job-1",
			status: "queued",
			updatedAt: "2026-01-01T00:00:00.000Z",
		});
		expect(json.transcript).toBeUndefined();
	});

	it("returns completed transcript payload", async () => {
		getJobMock.mockResolvedValue(
			job({
				status: "completed",
				transcript: "hello",
				provider: "whisper-cpp",
			}),
		);

		const { status, json } = await call();

		expect(status).toBe(200);
		expect(json.transcript).toBe("hello");
		expect(json.provider).toBe("whisper-cpp");
		expect(json.noSpeech).toBe(false);
	});

	it("returns failed reason without transcript", async () => {
		getJobMock.mockResolvedValue(
			job({
				status: "failed",
				failReason: "decode: bad codec",
				provider: "whisper-cpp",
			}),
		);

		const { status, json } = await call();

		expect(status).toBe(200);
		expect(json.failReason).toBe("decode: bad codec");
		expect(json.transcript).toBeUndefined();
	});
});
