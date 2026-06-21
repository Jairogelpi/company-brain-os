import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { processFile, transcribeWithWhisper } from "./ocr-pipeline";
import { createTranscriptionService } from "./transcription";

const uploadDir = join(process.cwd(), "uploads");

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

	it("returns explicit unsupported placeholders for audio/video files", async () => {
		const result = await processFile("interview.mp3", "audio/mpeg");

		expect(result.method).toBe("unsupported");
		expect(result.confidence).toBe(0);
		expect(result.text).toContain("Transcription pending for interview.mp3");
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

describe("transcription contract", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("stub whisper hook makes lack of implementation explicit", async () => {
		await expect(
			transcribeWithWhisper("/tmp/interview.mp3"),
		).resolves.toContain("Whisper not yet integrated");
	});

	it("falls back to stub transcription when Ollama is unavailable", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new Error("connection refused")),
		);

		const result = await createTranscriptionService().transcribe(
			"/tmp/interview.mp3",
			"audio/mpeg",
		);

		expect(result).toMatchObject({
			provider: "stub",
			language: "unknown",
			confidence: 0,
		});
		expect(result.text).toContain("interview.mp3");
	});
});
