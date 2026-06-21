import type {
	TranscriptionResult,
	TranscriptionService,
} from "../transcription";

const UNAVAILABLE_RESULT: TranscriptionResult = {
	text: "",
	language: "unknown",
	confidence: 0,
	provider: "unavailable",
};

export class UnavailableService implements TranscriptionService {
	async transcribe(
		_filePath: string,
		_mimeType: string,
	): Promise<TranscriptionResult> {
		return { ...UNAVAILABLE_RESULT };
	}

	async transcribeBuffer(
		_buffer: Buffer,
		_mimeType: string,
	): Promise<TranscriptionResult> {
		return { ...UNAVAILABLE_RESULT };
	}
}
