import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ensureTranscriptionWorkerStarted,
	stopTranscriptionWorkerForTests,
} from "./transcription-bootstrap";

describe("transcription worker bootstrap", () => {
	afterEach(() => {
		delete process.env.TRANSCRIPTION_WORKER_DISABLED;
		stopTranscriptionWorkerForTests();
	});

	it("starts the worker only once", () => {
		const stop = vi.fn();
		const start = vi.fn(() => stop);

		const first = ensureTranscriptionWorkerStarted(start);
		const second = ensureTranscriptionWorkerStarted(start);

		expect(first).toBe(stop);
		expect(second).toBe(stop);
		expect(start).toHaveBeenCalledTimes(1);
	});

	it("can be disabled for environments that run a separate worker", () => {
		process.env.TRANSCRIPTION_WORKER_DISABLED = "1";
		const start = vi.fn(() => vi.fn());

		ensureTranscriptionWorkerStarted(start);

		expect(start).not.toHaveBeenCalled();
	});

	it("stops and resets for tests", () => {
		const stop = vi.fn();
		ensureTranscriptionWorkerStarted(() => stop);

		stopTranscriptionWorkerForTests();
		ensureTranscriptionWorkerStarted(() => vi.fn());

		expect(stop).toHaveBeenCalledTimes(1);
	});
});
