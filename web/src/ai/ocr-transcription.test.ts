import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { processFile } from "./ocr-pipeline";
import {
	TranscriptionError,
	type TranscriptionResult,
	type TranscriptionService,
} from "./transcription";

const uploadDir = join(process.cwd(), "uploads");

function fakeService(result: TranscriptionResult): TranscriptionService {
	return {
		transcribe: vi.fn().mockResolvedValue(result),
		transcribeBuffer: vi.fn().mockResolvedValue(result),
	};
}

function throwingService(
	code: "unavailable" | "decode",
	message: string,
): TranscriptionService {
	const err = new TranscriptionError(code, message);
	return {
		transcribe: vi.fn().mockRejectedValue(err),
		transcribeBuffer: vi.fn().mockRejectedValue(err),
	};
}

describe("OCR/text processing contract", () => {
	beforeEach(async () => {
		await mkdir(uploadDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(join(uploadDir, "sample.txt"), { force: true });
		await rm(join(uploadDir, "sample.md"), { force: true });
	});

	it("extracts text files without invoking OCR", async () => {
		await writeFile(
			join(uploadDir, "sample.txt"),
			"Manual de producción",
			"utf8",
		);

		const result = await processFile("sample.txt", "text/plain");

		expect(result).toEqual({
			text: "Manual de producción",
			method: "text",
			confidence: 100,
		});
	});

	it("returns explicit unsupported placeholders for unknown binary files", async () => {
		const result = await processFile("archive.bin", "application/octet-stream");

		expect(result).toEqual({
			text: "[File: archive.bin]",
			method: "unsupported",
			confidence: 0,
		});
	});
});

describe("media transcription via provider seam (AC-1, AC-2, AC-7, AC-10, AC-11)", () => {
	it("returns a real transcript on an audio happy path (AC-1)", async () => {
		const svc = fakeService({
			text: "real transcript",
			language: "en",
			confidence: 80,
			provider: "whisper-cpp",
		});
		const result = await processFile("interview.mp3", "audio/mpeg", svc);

		expect(result.method).toBe("text");
		expect(result.text).toBe("real transcript");
		expect(result.confidence).toBe(80);
		expect(result.text).not.toContain("Transcription pending");
		expect(result.text).not.toContain("not yet integrated");
		expect(result.text).not.toContain("unsupported");
	});

	it("transcribes a video audio track (AC-2)", async () => {
		const svc = fakeService({
			text: "meeting transcript",
			language: "en",
			confidence: 75,
			provider: "whisper-cpp",
		});
		const result = await processFile("meeting.webm", "video/webm", svc);

		expect(result.method).toBe("text");
		expect(result.text).toBe("meeting transcript");
	});

	it("triangulate: audio/wav and video/mp4 happy paths", async () => {
		const wavSvc = fakeService({
			text: "wav transcript",
			language: "en",
			confidence: 70,
			provider: "whisper-cpp",
		});
		const wavResult = await processFile("call.wav", "audio/wav", wavSvc);
		expect(wavResult).toEqual({
			text: "wav transcript",
			method: "text",
			confidence: 70,
		});

		const mp4Svc = fakeService({
			text: "mp4 transcript",
			language: "en",
			confidence: 72,
			provider: "whisper-api",
		});
		const mp4Result = await processFile("clip.mp4", "video/mp4", mp4Svc);
		expect(mp4Result).toEqual({
			text: "mp4 transcript",
			method: "text",
			confidence: 72,
		});
	});

	it("returns empty text on silent audio (AC-7)", async () => {
		const svc = fakeService({
			text: "",
			language: "unknown",
			confidence: 0,
			provider: "whisper-cpp",
			noSpeech: true,
		});
		const result = await processFile("silent.mp3", "audio/mpeg", svc);

		expect(result.method).toBe("text");
		expect(result.text).toBe("");
		expect(result.confidence).toBe(0);
	});

	it("re-throws TranscriptionError(unavailable) — no placeholder content (AC-3)", async () => {
		const svc = throwingService("unavailable", "backend down");
		await expect(
			processFile("interview.mp3", "audio/mpeg", svc),
		).rejects.toMatchObject({
			name: "TranscriptionError",
			code: "unavailable",
		});
	});

	it("re-throws TranscriptionError(decode) on unsupported codec (AC-11)", async () => {
		const svc = throwingService("decode", "unknown codec");
		await expect(processFile("x.mp3", "audio/mpeg", svc)).rejects.toMatchObject(
			{ name: "TranscriptionError", code: "decode" },
		);
	});
});
