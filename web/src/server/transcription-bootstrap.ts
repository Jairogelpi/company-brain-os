import {
	startTranscriptionWorker,
	type StopFn,
} from "./transcription-worker";

let stopWorker: StopFn | null = null;

export function ensureTranscriptionWorkerStarted(
	start: () => StopFn = () => startTranscriptionWorker(),
): StopFn {
	if (stopWorker) return stopWorker;
	if (process.env.TRANSCRIPTION_WORKER_DISABLED === "1") {
		return () => undefined;
	}
	stopWorker = start();
	return stopWorker;
}

export function stopTranscriptionWorkerForTests(): void {
	stopWorker?.();
	stopWorker = null;
}
