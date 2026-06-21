import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import {
	TranscriptionError,
	type TranscriptionResult,
	type TranscriptionService,
} from "../transcription";
import { UnavailableService } from "./unavailable";

export interface CloudSttEnv {
	TRANSCRIPTION_CLOUD_URL?: string;
	TRANSCRIPTION_CLOUD_API_KEY?: string;
}

export function makeCloudService(env: CloudSttEnv): TranscriptionService {
	if (!env.TRANSCRIPTION_CLOUD_API_KEY) {
		return new UnavailableService();
	}
	return new CloudSttService(env);
}

export class CloudSttService implements TranscriptionService {
	private readonly url: string;
	private readonly apiKey: string;

	constructor(env: CloudSttEnv) {
		this.url = (
			env.TRANSCRIPTION_CLOUD_URL ??
			"https://api.openai.com/v1/audio/transcriptions"
		).replace(/\/$/, "");
		this.apiKey = env.TRANSCRIPTION_CLOUD_API_KEY!;
	}

	async transcribe(
		filePath: string,
		mimeType: string,
	): Promise<TranscriptionResult> {
		const buffer = await readFile(filePath);
		return this.transcribeBuffer(buffer, mimeType, basename(filePath));
	}

	async transcribeBuffer(
		buffer: Buffer,
		mimeType: string,
		filename = "audio.bin",
	): Promise<TranscriptionResult> {
		const form = new FormData();
		form.append(
			"file",
			new Blob([new Uint8Array(buffer)], { type: mimeType }),
			filename,
		);
		form.append("response_format", "json");

		let res: Response;
		try {
			res = await fetch(this.url, {
				method: "POST",
				headers: { Authorization: `Bearer ${this.apiKey}` },
				body: form,
			});
		} catch (cause) {
			throw new TranscriptionError(
				"unavailable",
				`cloud STT unreachable: ${(cause as Error).message}`,
			);
		}

		if (!res.ok) {
			const body = await res.text().catch(() => "");
			const lower = body.toLowerCase();
			if (
				res.status >= 400 &&
				res.status < 500 &&
				/decode|codec|format|unsupported/.test(lower)
			) {
				throw new TranscriptionError(
					"decode",
					`cloud STT decode error: ${body.slice(0, 200)}`,
				);
			}
			throw new TranscriptionError(
				"unavailable",
				`cloud STT returned ${res.status}: ${body.slice(0, 200)}`,
			);
		}

		const json = (await res.json().catch(() => ({}))) as {
			text?: string;
			language?: string;
		};
		const text = (json.text ?? "").trim();
		if (text === "") {
			return {
				text: "",
				language: json.language ?? "unknown",
				confidence: 0,
				provider: "whisper-api",
				noSpeech: true,
			};
		}
		return {
			text,
			language: json.language ?? "unknown",
			confidence: 80,
			provider: "whisper-api",
		};
	}
}
