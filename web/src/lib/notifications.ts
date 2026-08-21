export type NotificationChannel = "email" | "in_app";
export type NotificationStatus =
	| "pending"
	| "processing"
	| "delivered"
	| "failed"
	| "dead_letter";

export type NotificationDraft = {
	id: string;
	companyId: string;
	recipientId: string;
	channel: NotificationChannel;
	destination?: string;
	title: string;
	body: string;
	actionUrl?: string;
	status: NotificationStatus;
	attempts: number;
	nextAttemptAt: Date;
	idempotencyKey: string;
};

type MissionAssignmentInput = {
	companyId: string;
	recipientId: string;
	recipientEmail?: string;
	missionId: string;
	missionObjective: string;
	eventId: string;
	now?: Date;
	id?: () => string;
};

/**
 * Builds durable rows for a mission assignment. In-app delivery is immediately
 * available; email remains pending until the external provider acknowledges it.
 */
export function missionAssignmentNotifications(
	input: MissionAssignmentInput,
): NotificationDraft[] {
	const now = input.now ?? new Date();
	const nextId = input.id ?? (() => globalThis.crypto.randomUUID());
	const base = {
		companyId: input.companyId,
		recipientId: input.recipientId,
		title: "New mission assigned",
		body: `You have been assigned: "${input.missionObjective}". Log in to Company Brain to view details.`,
		actionUrl: `/missions#${input.missionId}`,
		attempts: 0,
		nextAttemptAt: now,
	};
	const rows: NotificationDraft[] = [
		{
			...base,
			id: `notif-${nextId()}`,
			channel: "in_app",
			status: "delivered",
			idempotencyKey: `mission-assigned:${input.eventId}:in_app`,
		},
	];
	if (input.recipientEmail?.trim()) {
		rows.push({
			...base,
			id: `notif-${nextId()}`,
			channel: "email",
			destination: input.recipientEmail.trim().toLowerCase(),
			status: "pending",
			idempotencyKey: `mission-assigned:${input.eventId}:email`,
		});
	}
	return rows;
}

export interface EmailNotificationProvider {
	deliver(input: {
		id: string;
		to: string;
		title: string;
		body: string;
		actionUrl?: string;
	}): Promise<void>;
}

/** A real HTTP delivery boundary. Missing configuration never fakes success. */
export function createEmailNotificationProvider(
	env: NodeJS.ProcessEnv = process.env,
	fetchImpl: typeof fetch = fetch,
): EmailNotificationProvider {
	const endpoint = env.NOTIFICATION_EMAIL_WEBHOOK_URL?.trim();
	const token = env.NOTIFICATION_EMAIL_WEBHOOK_TOKEN?.trim();
	const appBaseUrl = env.APP_BASE_URL?.trim();
	return {
		async deliver(input) {
			if (!endpoint || !token) {
				throw new Error("Email notification provider is not configured");
			}
			const payload = {
				...input,
				actionUrl: input.actionUrl && appBaseUrl
					? new URL(input.actionUrl, appBaseUrl).toString()
					: input.actionUrl,
			};
			const response = await fetchImpl(endpoint, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${token}`,
					"idempotency-key": input.id,
				},
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(10_000),
			});
			if (!response.ok) {
				throw new Error(`Email notification provider returned ${response.status}`);
			}
		},
	};
}

export function notificationRetryAt(attempts: number, now = new Date()): Date {
	const seconds = Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1));
	return new Date(now.getTime() + seconds * 1000);
}
