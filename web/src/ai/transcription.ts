/**
 * Transcription service for audio/video files.
 *
 * Primary: Ollama multimodal (if available).
 * Fallback: stub (returns placeholder).
 * Production: OpenAI Whisper API / whisper.cpp / cloud STT.
 */

export interface TranscriptionResult {
	text: string;
	language: string;
	confidence: number;
	provider: "ollama" | "stub" | "whisper-api";
}

export interface TranscriptionService {
	transcribe(filePath: string, mimeType: string): Promise<TranscriptionResult>;
	transcribeBuffer(
		buffer: Buffer,
		mimeType: string,
	): Promise<TranscriptionResult>;
}

/**
 * Stub transcription — returns a placeholder.
 * Used when no real transcription service is available.
 */
class StubTranscriptionService implements TranscriptionService {
	async transcribe(
		filePath: string,
		_mimeType: string,
	): Promise<TranscriptionResult> {
		return {
			text: `[Transcription pending for ${filePath.split("/").pop() ?? filePath}. Integrate Whisper API or whisper.cpp for production.]`,
			language: "unknown",
			confidence: 0,
			provider: "stub",
		};
	}

	async transcribeBuffer(
		_buffer: Buffer,
		_mimeType: string,
	): Promise<TranscriptionResult> {
		return {
			text: "[Transcription pending. Integrate Whisper for production.]",
			language: "unknown",
			confidence: 0,
			provider: "stub",
		};
	}
}

/**
 * Ollama-based transcription using a multimodal model.
 * Falls back to stub if Ollama is unavailable.
 */
class OllamaTranscriptionService implements TranscriptionService {
	private ollamaUrl = "http://localhost:11434/api/generate";

	async transcribe(
		filePath: string,
		mimeType: string,
	): Promise<TranscriptionResult> {
		try {
			// Check if Ollama is reachable
			const tagsRes = await fetch("http://localhost:11434/api/tags", {
				signal: AbortSignal.timeout(3000),
			});
			if (!tagsRes.ok) throw new Error("Ollama not available");
		} catch {
			return new StubTranscriptionService().transcribe(filePath, mimeType);
		}

		// Ollama doesn't have native audio input via API yet.
		// This is a placeholder for future Ollama audio support.
		return new StubTranscriptionService().transcribe(filePath, mimeType);
	}

	async transcribeBuffer(
		_buffer: Buffer,
		mimeType: string,
	): Promise<TranscriptionResult> {
		return this.transcribe("buffer", mimeType);
	}
}

/**
 * Factory: returns the best available transcription service.
 */
export function createTranscriptionService(): TranscriptionService {
	return new OllamaTranscriptionService();
}

// Re-export for convenience
export const transcriptionService = createTranscriptionService();
