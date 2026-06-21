/**
 * OCR and document processing pipeline.
 *
 * Tesseract.js for images (OCR). Text extraction for documents.
 * Audio/video → real transcription via the injectable `TranscriptionService`
 * seam (whisper.cpp default, cloud fallback, explicit unavailability).
 */

import { createWorker } from "tesseract.js";
import { join } from "path";
import { readFile } from "fs/promises";
import {
	type TranscriptionResult,
	type TranscriptionService,
	TranscriptionError,
	transcriptionService,
} from "./transcription";

const UPLOAD_DIR = join(process.cwd(), "uploads");

export type OcrResult = {
	text: string;
	confidence: number; // 0-100
	language: string;
	processingTimeMs: number;
};

export type ProcessingResult = {
	text: string;
	method: "ocr" | "text" | "unsupported";
	confidence: number;
};

/**
 * Map a `TranscriptionResult` to the `processFile` media-branch output.
 * Empty text (silent audio) is returned as `method: "text"` with an empty
 * string — the caller (worker) decides whether to mark the job `completed`
 * with the no-speech marker (AC-7).
 */
function toOcrResult(r: TranscriptionResult): ProcessingResult {
	return { text: r.text, method: "text", confidence: r.confidence };
}

/**
 * Process an uploaded file and extract text content.
 *
 * Images → OCR via Tesseract.js
 * Text/markdown → direct read
 * PDF → OCR (first page) via Tesseract
 * Video/audio → real transcription via `service` (default: module singleton)
 *
 * The optional `service` argument is the provider-seam injection point so
 * tests can mock the transcription boundary without touching `fetch`.
 */
export async function processFile(
	filename: string,
	mimeType: string,
	service: TranscriptionService = transcriptionService,
): Promise<ProcessingResult> {
	const filePath = join(UPLOAD_DIR, filename);
	const lower = filename.toLowerCase();

	// Images: OCR
	if (
		mimeType.startsWith("image/") ||
		["png", "jpg", "jpeg", "gif", "webp", "bmp"].some((e) =>
			lower.endsWith(`.${e}`),
		)
	) {
		const ocr = await runOcr(filePath);
		return { text: ocr.text, method: "ocr", confidence: ocr.confidence };
	}

	// PDF: try OCR
	if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
		const ocr = await runOcr(filePath);
		return { text: ocr.text, method: "ocr", confidence: ocr.confidence };
	}

	// Plain text / markdown: read directly
	if (
		mimeType.startsWith("text/") ||
		lower.endsWith(".txt") ||
		lower.endsWith(".md")
	) {
		const buffer = await readFile(filePath);
		return { text: buffer.toString("utf-8"), method: "text", confidence: 100 };
	}

	// Video/audio: real transcription via the provider seam (AC-1, AC-2, AC-7,
	// AC-11). Re-throw on unavailable/decode so the worker records a `failed`
	// job — never return a placeholder string that looks like content (AC-3).
	if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
		const r = await service.transcribe(filePath, mimeType);
		if (r.provider === "unavailable") {
			throw new TranscriptionError(
				"unavailable",
				"transcription provider unavailable",
			);
		}
		if (r.decodeError) {
			throw new TranscriptionError("decode", r.decodeError);
		}
		return toOcrResult(r);
	}

	// Unsupported: return filename as text
	return {
		text: `[File: ${filename}]`,
		method: "unsupported",
		confidence: 0,
	};
}

/**
 * Run Tesseract OCR on an image or PDF.
 */
async function runOcr(filePath: string): Promise<OcrResult> {
	const start = Date.now();
	const worker = await createWorker("eng+spa");

	try {
		const { data } = await worker.recognize(filePath);
		const processingTimeMs = Date.now() - start;

		return {
			text: data.text.trim(),
			confidence: Math.round(data.confidence),
			language: "eng+spa",
			processingTimeMs,
		};
	} finally {
		await worker.terminate();
	}
}
