import {
	createEmailNotificationProvider,
	notificationRetryAt,
	type EmailNotificationProvider,
} from "@/lib/notifications";
import {
	claimPendingNotifications,
	completeNotificationDelivery,
	failNotificationDelivery,
	type NotificationRow,
} from "./notifications";
import type { StopFn } from "./transcription-worker";

const MAX_ATTEMPTS = 8;

type WorkerOptions = {
	provider?: EmailNotificationProvider;
	batchSize?: number;
	claim?: (limit: number) => Promise<NotificationRow[]>;
	complete?: (row: NotificationRow) => Promise<void>;
	fail?: (
		row: NotificationRow,
		error: string,
		nextAttemptAt: Date,
		deadLetter: boolean,
	) => Promise<void>;
};

export async function runNotificationWorkerOnce(
	options: WorkerOptions = {},
): Promise<void> {
	const provider = options.provider ?? createEmailNotificationProvider();
	const claim = options.claim ?? claimPendingNotifications;
	const complete = options.complete ?? completeNotificationDelivery;
	const fail = options.fail ?? failNotificationDelivery;
	const rows = await claim(options.batchSize ?? 20);
	for (const row of rows) {
		try {
			if (row.channel !== "email" || !row.destination) {
				throw new Error("Notification delivery row is not a valid email");
			}
			await provider.deliver({
				id: row.id,
				to: row.destination,
				title: row.title,
				body: row.body,
				actionUrl: row.actionUrl ?? undefined,
			});
			await complete(row);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Notification delivery failed";
			await fail(
				row,
				message,
				notificationRetryAt(row.attempts),
				row.attempts >= MAX_ATTEMPTS,
			);
		}
	}
}

export function startNotificationWorker(
	options: WorkerOptions & { intervalMs?: number; runOnce?: () => Promise<void> } = {},
): StopFn {
	const configured = options.intervalMs ?? Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS);
	const intervalMs = configured || 5000;
	let running = false;
	const runOnce = options.runOnce ?? (() => runNotificationWorkerOnce(options));
	const timer = setInterval(() => {
		if (running) return;
		running = true;
		void runOnce().finally(() => {
			running = false;
		});
	}, intervalMs);
	return () => clearInterval(timer);
}
