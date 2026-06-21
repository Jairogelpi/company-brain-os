import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUserMock = vi.fn();
const sizeMock = vi.fn();
const createJobMock = vi.fn();

vi.mock("@/auth/api-guard", () => ({ requireApiUser: requireApiUserMock }));
vi.mock("@/lib/storage", () => ({
	getStorage: () => ({ size: sizeMock }),
}));
vi.mock("@/server/transcription-jobs", () => ({ createJob: createJobMock }));

const { POST } = await import("./route");

const filename = "00000000-0000-4000-8000-000000000001.mp3";

function authedUser() {
	return {
		id: "user-1",
		companyId: "companyA",
		role: "contributor" as const,
		name: "Test",
		email: "t@example.com",
		validationDomains: [] as string[],
	};
}

function request(body: unknown): Request {
	return new Request("http://localhost/api/transcribe", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

async function call(body: unknown) {
	const res = await POST(request(body));
	return { status: res.status, json: await res.json() };
}

describe("POST /api/transcribe", () => {
	beforeEach(() => {
		requireApiUserMock.mockReset().mockResolvedValue(authedUser());
		sizeMock.mockReset().mockResolvedValue(1024);
		createJobMock.mockReset().mockResolvedValue({ id: "job-1", status: "queued" });
	});

	it("returns 401 when unauthenticated", async () => {
		requireApiUserMock.mockResolvedValue(
			NextResponse.json({ error: "Authentication required." }, { status: 401 }),
		);

		const { status } = await call({ filename, mimeType: "audio/mpeg" });

		expect(status).toBe(401);
		expect(createJobMock).not.toHaveBeenCalled();
	});

	it("rejects invalid filenames", async () => {
		const { status } = await call({ filename: "../x.mp3", mimeType: "audio/mpeg" });

		expect(status).toBe(400);
		expect(createJobMock).not.toHaveBeenCalled();
	});

	it("rejects non-media MIME types", async () => {
		const { status } = await call({ filename, mimeType: "text/plain" });

		expect(status).toBe(400);
		expect(createJobMock).not.toHaveBeenCalled();
	});

	it("rejects missing storage objects", async () => {
		sizeMock.mockResolvedValue(null);

		const { status } = await call({ filename, mimeType: "audio/mpeg" });

		expect(status).toBe(404);
		expect(createJobMock).not.toHaveBeenCalled();
	});

	it("rejects media over the configured media limit", async () => {
		sizeMock.mockResolvedValue(101 * 1024 * 1024);

		const { status } = await call({ filename, mimeType: "audio/mpeg" });

		expect(status).toBe(413);
		expect(createJobMock).not.toHaveBeenCalled();
	});

	it("enqueues a scoped transcription job", async () => {
		const { status, json } = await call({
			filename,
			mimeType: "audio/mpeg",
			source: "interview.mp3",
		});

		expect(status).toBe(200);
		expect(json).toEqual({
			jobId: "job-1",
			status: "queued",
			statusUrl: "/api/transcribe/jobs/job-1",
		});
		expect(createJobMock).toHaveBeenCalledWith({
			companyId: "companyA",
			userId: "user-1",
			source: "interview.mp3",
			storageKey: filename,
			mimeType: "audio/mpeg",
		});
	});
});
