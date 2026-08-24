import { cleanupExpiredUploads } from "./uploads";
import type { StopFn } from "./transcription-worker";

export async function runUploadRetentionOnce(
	cleanup: () => Promise<unknown> = () => cleanupExpiredUploads(),
): Promise<void> {
	await cleanup();
}

export function startUploadRetentionWorker(options: {
	intervalMs?: number;
	runOnce?: () => Promise<void>;
} = {}): StopFn {
	const configured = options.intervalMs ?? Number(process.env.UPLOAD_RETENTION_WORKER_INTERVAL_MS);
	const intervalMs = configured || 60_000;
	const runOnce = options.runOnce ?? (() => runUploadRetentionOnce());
	let running = false;
	const timer = setInterval(() => {
		if (running) return;
		running = true;
		void runOnce().finally(() => {
			running = false;
		});
	}, intervalMs);
	return () => clearInterval(timer);
}
