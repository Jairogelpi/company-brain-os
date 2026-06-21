/**
 * Notification system — email/push when missions are assigned.
 * Stub for production (SendGrid, Resend, Firebase, etc.).
 */

export type NotificationChannel = "email" | "push" | "in_app";

export interface Notification {
	id: string;
	recipientId: string;
	recipientEmail?: string;
	channel: NotificationChannel;
	title: string;
	body: string;
	actionUrl?: string;
	createdAt: string;
	sent: boolean;
}

const notifications: Notification[] = [];
let nextId = 1;

export function sendNotification(params: {
	recipientId: string;
	recipientEmail?: string;
	channel: NotificationChannel;
	title: string;
	body: string;
	actionUrl?: string;
}): Notification {
	const notification: Notification = {
		id: `notif-${nextId++}`,
		recipientId: params.recipientId,
		recipientEmail: params.recipientEmail,
		channel: params.channel,
		title: params.title,
		body: params.body,
		actionUrl: params.actionUrl,
		createdAt: new Date().toISOString(),
		sent: false,
	};

	notifications.push(notification);

	// In production: actually send via email/push provider
	// For now, just mark as sent after a tick
	setTimeout(() => {
		notification.sent = true;
	}, 0);

	return notification;
}

export function notifyMissionAssigned(
	assigneeId: string,
	assigneeEmail: string | undefined,
	missionObjective: string,
	missionId: string,
): Notification {
	return sendNotification({
		recipientId: assigneeId,
		recipientEmail: assigneeEmail,
		channel: "email",
		title: "New mission assigned",
		body: `You have been assigned: "${missionObjective}". Log in to Company Brain to view details.`,
		actionUrl: `/missions/${missionId}`,
	});
}

export function getNotifications(recipientId: string): Notification[] {
	return notifications.filter((n) => n.recipientId === recipientId);
}

export function getUnreadCount(recipientId: string): number {
	return notifications.filter((n) => n.recipientId === recipientId && !n.sent)
		.length;
}

export function clearNotifications(): void {
	notifications.length = 0;
	nextId = 1;
}
