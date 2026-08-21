import { describe, expect, it, vi } from "vitest";
import { runUploadRetentionOnce, startUploadRetentionWorker } from "./upload-retention-worker";

describe("upload retention worker", () => {
	it("delegates one cleanup pass", async () => {
		const cleanup = vi.fn().mockResolvedValue({ deleted: 2, failed: 0 });
		await runUploadRetentionOnce(cleanup);
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("does not overlap cleanup passes", async () => {
		vi.useFakeTimers();
		let release!: () => void;
		const runOnce = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
		const stop = startUploadRetentionWorker({ intervalMs: 10, runOnce });
		await vi.advanceTimersByTimeAsync(30);
		expect(runOnce).toHaveBeenCalledTimes(1);
		release();
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(10);
		expect(runOnce).toHaveBeenCalledTimes(2);
		stop();
		vi.useRealTimers();
	});
});
