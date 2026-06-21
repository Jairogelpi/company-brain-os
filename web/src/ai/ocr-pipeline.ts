/**
 * OCR and document processing pipeline.
 *
 * Tesseract.js for images (OCR). Text extraction for documents.
 * In production, add Whisper (via Ollama or API) for audio/video transcription.
 */

import { createWorker } from "tesseract.js";
import { join } from "path";
import { readFile } from "fs/promises";

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
 * Process an uploaded file and extract text content.
 *
 * Images → OCR via Tesseract.js
 * Text/markdown → direct read
 * PDF → OCR (first page) via Tesseract
 * Video/audio → stub (Whisper integration point)
 */
export async function processFile(
	filename: string,
	mimeType: string,
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

	// Video/audio: stub for Whisper integration
	if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
		return {
			text: `[Transcription pending for ${filename}. Integrate Whisper via Ollama for audio/video transcription.]`,
			method: "unsupported",
			confidence: 0,
		};
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

/**
 * Transcribe audio/video using Whisper (via Ollama).
 * This is a stub for future integration.
 *
 * Ollama supports Whisper models:
 *   ollama pull whisper
 *   ollama run whisper <audio-file>
 */
export async function transcribeWithWhisper(
	_filePath: string,
): Promise<string> {
	// Stub: integrate Whisper via Ollama in production
	// const response = await fetch("http://localhost:11434/api/generate", { ... });
	return "[Transcription via Whisper not yet integrated. Ready for production deployment.]";
}
