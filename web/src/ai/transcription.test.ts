import { afterEach, describe, expect, it, vi } from "vitest";
import {
	TranscriptionError,
	type TranscriptionResult,
	createTranscriptionService,
} from "./transcription";
import { UnavailableService } from "./transcription-providers/unavailable";
import { WhisperCppService } from "./transcription-providers/whisper-cpp";
import { CloudSttService } from "./transcription-providers/cloud";

// --- Compile-time contract: provider union rejects stub/ollama ---

describe("TranscriptionResult provider contract", () => {
	it('accepts "whisper-cpp" | "whisper-api" | "unavailable" and rejects "stub"/"ollama"', () => {
		const ok: TranscriptionResult = {
			text: "hi",
			language: "en",
			confidence: 80,
			provider: "whisper-cpp",
		};
		expect(ok.provider).toBe("whisper-cpp");

		const badStub: TranscriptionResult = {
			text: "",
			language: "x",
			confidence: 0,
			// @ts-expect-error "stub" is not a valid production provider
			provider: "stub",
		};
		const badOllama: TranscriptionResult = {
			text: "",
			language: "x",
			confidence: 0,
			// @ts-expect-error "ollama" is not a valid production provider
			provider: "ollama",
		};
		expect(badStub).toBeDefined();
		expect(badOllama).toBeDefined();
	});

	it("supports optional noSpeech and decodeError fields", () => {
		const r: TranscriptionResult = {
			text: "",
			language: "unknown",
			confidence: 0,
			provider: "whisper-cpp",
			noSpeech: true,
			decodeError: undefined,
		};
		expect(r.noSpeech).toBe(true);
	});
});

describe("TranscriptionError", () => {
	it("is an Error instance with a code property", () => {
		const err = new TranscriptionError("unavailable", "backend down");
		expect(err).toBeInstanceOf(Error);
		expect(err.code).toBe("unavailable");
		expect(err.message).toBe("backend down");
		expect(err.name).toBe("TranscriptionError");
	});

	it("supports decode and config codes", () => {
		expect(new TranscriptionError("decode", "bad codec").code).toBe("decode");
		expect(new TranscriptionError("config", "no key").code).toBe("config");
	});
});

describe("UnavailableService", () => {
	const svc = new UnavailableService();

	it("returns provider:unavailable without throwing (audio)", async () => {
		const r = await svc.transcribe("x.mp3", "audio/mpeg");
		expect(r).toEqual({
			text: "",
			language: "unknown",
			confidence: 0,
			provider: "unavailable",
		});
	});

	it("returns provider:unavailable for transcribeBuffer too", async () => {
		const r = await svc.transcribeBuffer(Buffer.from(""), "video/webm");
		expect(r.provider).toBe("unavailable");
		expect(r.text).toBe("");
	});
});

describe("WhisperCppService", () => {
	const env = {
		WHISPER_CPP_URL: "http://localhost:8080",
		WHISPER_CPP_MODEL: "ggml-base.en.bin",
	};
	// Use transcribeBuffer so no real file read is needed; fetch is stubbed.
	const svc = () => new WhisperCppService(env);

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("transcribes audio via multipart POST and returns whisper-cpp provider", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ text: "hello world" }), {
					status: 200,
				}),
			),
		);
		const r = await svc().transcribeBuffer(Buffer.from("audio"), "audio/mpeg");
		expect(r.text).toBe("hello world");
		expect(r.provider).toBe("whisper-cpp");
		expect(r.confidence).toBeGreaterThan(0);
	});

	it("transcribes video audio track (video/webm)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ text: "meeting notes" }), {
					status: 200,
				}),
			),
		);
		const r = await svc().transcribeBuffer(Buffer.from("video"), "video/webm");
		expect(r.text).toBe("meeting notes");
		expect(r.provider).toBe("whisper-cpp");
	});

	it("returns noSpeech:true on 2xx with empty text", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response(JSON.stringify({ text: "   " }), { status: 200 }),
				),
		);
		const r = await svc().transcribeBuffer(Buffer.from(""), "audio/mpeg");
		expect(r.text).toBe("");
		expect(r.noSpeech).toBe(true);
		expect(r.provider).toBe("whisper-cpp");
	});

	it("throws TranscriptionError(unavailable) on fetch rejection", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
		);
		await expect(
			svc().transcribeBuffer(Buffer.from(""), "audio/mpeg"),
		).rejects.toMatchObject({
			name: "TranscriptionError",
			code: "unavailable",
		});
	});

	it("throws TranscriptionError(unavailable) on non-2xx server error", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(new Response("internal error", { status: 500 })),
		);
		await expect(
			svc().transcribeBuffer(Buffer.from(""), "audio/mpeg"),
		).rejects.toMatchObject({
			name: "TranscriptionError",
			code: "unavailable",
		});
	});

	it("throws TranscriptionError(decode) on 4xx with decode hint", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ error: "could not decode codec" }), {
					status: 400,
				}),
			),
		);
		await expect(
			svc().transcribeBuffer(Buffer.from(""), "audio/mpeg"),
		).rejects.toMatchObject({ name: "TranscriptionError", code: "decode" });
	});

	it("propagates a returned language field", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ text: "hola", language: "es" }), {
					status: 200,
				}),
			),
		);
		const r = await svc().transcribeBuffer(Buffer.from(""), "audio/mpeg");
		expect(r.language).toBe("es");
	});
});

describe("createTranscriptionService factory (AC-4)", () => {
	it("returns WhisperCppService by default", () => {
		const svc = createTranscriptionService({});
		expect(svc).toBeInstanceOf(WhisperCppService);
	});

	it("returns CloudSttService when TRANSCRIPTION_PROVIDER=cloud with a key", () => {
		const svc = createTranscriptionService({
			TRANSCRIPTION_PROVIDER: "cloud",
			TRANSCRIPTION_CLOUD_API_KEY: "sk-test",
		});
		expect(svc).toBeInstanceOf(CloudSttService);
	});

	it("returns UnavailableService when cloud is selected without a key", () => {
		const svc = createTranscriptionService({ TRANSCRIPTION_PROVIDER: "cloud" });
		expect(svc).toBeInstanceOf(UnavailableService);
	});

	it("returns UnavailableService when TRANSCRIPTION_PROVIDER=none", () => {
		const svc = createTranscriptionService({ TRANSCRIPTION_PROVIDER: "none" });
		expect(svc).toBeInstanceOf(UnavailableService);
	});

	it("default does NOT return an OllamaTranscriptionService-like stub", () => {
		const svc = createTranscriptionService({});
		// The production path must not chain through Ollama→Stub.
		const proto = Object.getPrototypeOf(svc).constructor.name;
		expect(proto).not.toContain("Ollama");
		expect(proto).not.toContain("Stub");
	});
});
