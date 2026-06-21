/** Transcription provider seam for audio/video files. */

import {
	WhisperCppService,
	type WhisperCppEnv,
} from "./transcription-providers/whisper-cpp";
import {
	makeCloudService,
	type CloudSttEnv,
} from "./transcription-providers/cloud";
import { UnavailableService } from "./transcription-providers/unavailable";

export type TranscriptionProvider =
	| "whisper-cpp"
	| "whisper-api"
	| "unavailable";

export interface TranscriptionResult {
	text: string; // "" (empty/whitespace) on no-speech
	language: string; // "unknown" if the provider doesn't report it
	confidence: number; // 0-100; 0 when unknown but text present is allowed
	provider: TranscriptionProvider;
	/** Present only on no-speech so the caller can mark the job `completed`
	 * with an explicit empty marker instead of fabricating proposals. */
	noSpeech?: boolean;
	/** Present when the provider could not decode the bytes (codec error). */
	decodeError?: string;
}

export interface TranscriptionService {
	transcribe(filePath: string, mimeType: string): Promise<TranscriptionResult>;
	transcribeBuffer(
		buffer: Buffer,
		mimeType: string,
	): Promise<TranscriptionResult>;
}

/** Typed error for unreachable / decode / config failures. */
export class TranscriptionError extends Error {
	constructor(
		public readonly code: "unavailable" | "decode" | "config",
		message: string,
	) {
		super(message);
		this.name = "TranscriptionError";
	}
}

/** Config-driven factory. `env` is injectable for tests. */
type TranscriptionEnv = Partial<NodeJS.ProcessEnv> &
	WhisperCppEnv &
	CloudSttEnv & {
		TRANSCRIPTION_PROVIDER?: "whisper-cpp" | "cloud" | "none" | string;
	};

export function createTranscriptionService(
	env: TranscriptionEnv = process.env,
): TranscriptionService {
	switch (env.TRANSCRIPTION_PROVIDER ?? "whisper-cpp") {
		case "whisper-cpp":
			return new WhisperCppService(env);
		case "cloud":
			return makeCloudService(env); // → Unavailable if unconfigured
		case "none":
			return new UnavailableService();
		default:
			return new UnavailableService();
	}
}

// Module-level singleton for non-test callers.
export const transcriptionService = createTranscriptionService();
