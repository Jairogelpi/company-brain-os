import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import {
	TranscriptionError,
	type TranscriptionResult,
	type TranscriptionService,
} from "../transcription";

export interface WhisperCppEnv {
	WHISPER_CPP_URL?: string;
	WHISPER_CPP_MODEL?: string;
}

export class WhisperCppService implements TranscriptionService {
	private readonly url: string;
	private readonly model: string;

	constructor(env: WhisperCppEnv = {}) {
		this.url = (env.WHISPER_CPP_URL ?? "http://localhost:8080").replace(
			/\/$/,
			"",
		);
		this.model = env.WHISPER_CPP_MODEL ?? "ggml-base.en.bin";
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
		form.append("model", this.model);
		form.append("response_format", "json");

		let res: Response;
		try {
			res = await fetch(`${this.url}/inference`, {
				method: "POST",
				body: form,
			});
		} catch (cause) {
			throw new TranscriptionError(
				"unavailable",
				`whisper.cpp unreachable: ${(cause as Error).message}`,
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
					`whisper.cpp decode error: ${body.slice(0, 200)}`,
				);
			}
			throw new TranscriptionError(
				"unavailable",
				`whisper.cpp returned ${res.status}: ${body.slice(0, 200)}`,
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
				provider: "whisper-cpp",
				noSpeech: true,
			};
		}
		return {
			text,
			language: json.language ?? "unknown",
			confidence: 80,
			provider: "whisper-cpp",
		};
	}
}
