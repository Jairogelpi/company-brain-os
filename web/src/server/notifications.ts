import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { createDb, type Db } from "@/db";
import {
	companies,
	notifications as notificationRows,
} from "@/db/schema";
import { withTenantTransaction, type TenantTransaction } from "@/db/tenant-transaction";
import { missionAssignmentNotifications } from "@/lib/notifications";

export type NotificationRow = typeof notificationRows.$inferSelect;

export async function enqueueMissionAssignment(
	tx: TenantTransaction,
	input: {
		companyId: string;
		recipientId: string;
		recipientEmail?: string;
		missionId: string;
		missionObjective: string;
	},
): Promise<void> {
	const eventId = globalThis.crypto.randomUUID();
	const drafts = missionAssignmentNotifications({ ...input, eventId });
	await tx.insert(notificationRows).values(
		drafts.map((draft) => ({
			...draft,
			destination: draft.destination ?? null,
			actionUrl: draft.actionUrl ?? null,
			deliveredAt: draft.status === "delivered" ? draft.nextAttemptAt : null,
		})),
	);
}

export async function enqueueInvitationEmail(
	tx: TenantTransaction,
	input: {
		id: string;
		companyId: string;
		email: string;
		role: string;
		invitePath: string;
	},
): Promise<void> {
	await tx.insert(notificationRows).values({
		id: `notif-${globalThis.crypto.randomUUID()}`,
		companyId: input.companyId,
		recipientId: null,
		channel: "email",
		destination: input.email,
		title: "You are invited to Company Brain",
		body: `You have been invited as ${input.role}. The invitation expires in 7 days.`,
		actionUrl: input.invitePath,
		status: "pending",
		attempts: 0,
		nextAttemptAt: new Date(),
		idempotencyKey: `user-invitation:${input.id}:email`,
	});
}

export async function listUserNotifications(
	companyId: string,
	recipientId: string,
	limit = 50,
): Promise<NotificationRow[]> {
	const db = createDb();
	return withTenantTransaction(db, companyId, (tx) => tx
		.select()
		.from(notificationRows)
		.where(and(
			eq(notificationRows.companyId, companyId),
			eq(notificationRows.recipientId, recipientId),
			eq(notificationRows.channel, "in_app"),
		))
		.orderBy(desc(notificationRows.createdAt))
		.limit(Math.max(1, Math.min(limit, 100))));
}

export async function markNotificationRead(
	companyId: string,
	recipientId: string,
	id: string,
): Promise<boolean> {
	const db = createDb();
	const updated = await withTenantTransaction(db, companyId, (tx) => tx
		.update(notificationRows)
		.set({ readAt: new Date() })
		.where(and(
			eq(notificationRows.companyId, companyId),
			eq(notificationRows.recipientId, recipientId),
			eq(notificationRows.id, id),
		))
		.returning({ id: notificationRows.id }));
	return updated.length === 1;
}

export async function claimPendingNotifications(
	limit = 20,
	db: Db = createDb(),
	now = new Date(),
): Promise<NotificationRow[]> {
	const companyRows = await db.select({ id: companies.id }).from(companies);
	const claimed: NotificationRow[] = [];
	for (const company of companyRows) {
		if (claimed.length >= limit) break;
		const remaining = limit - claimed.length;
		const tenantClaimed = await withTenantTransaction(db, company.id, async (tx) => {
			const candidates = await tx
				.select()
				.from(notificationRows)
				.where(and(
					eq(notificationRows.companyId, company.id),
					// A processing row whose lease expired is reclaimed after a crash.
					inArray(notificationRows.status, ["pending", "failed", "processing"]),
					lte(notificationRows.nextAttemptAt, now),
				))
				.orderBy(asc(notificationRows.createdAt))
				.limit(remaining);
			const rows: NotificationRow[] = [];
			for (const candidate of candidates) {
				const [row] = await tx
					.update(notificationRows)
					.set({
						status: "processing",
						attempts: candidate.attempts + 1,
						nextAttemptAt: new Date(now.getTime() + 5 * 60_000),
					})
					.where(and(
						eq(notificationRows.companyId, company.id),
						eq(notificationRows.id, candidate.id),
						eq(notificationRows.status, candidate.status),
					))
					.returning();
				if (row) rows.push(row);
			}
			return rows;
		});
		claimed.push(...tenantClaimed);
	}
	return claimed;
}

export async function completeNotificationDelivery(
	row: NotificationRow,
	db: Db = createDb(),
): Promise<void> {
	await withTenantTransaction(db, row.companyId, (tx) => tx
		.update(notificationRows)
		.set({ status: "delivered", deliveredAt: new Date(), lastError: null })
		.where(and(
			eq(notificationRows.companyId, row.companyId),
			eq(notificationRows.id, row.id),
			eq(notificationRows.status, "processing"),
		)));
}

export async function failNotificationDelivery(
	row: NotificationRow,
	error: string,
	nextAttemptAt: Date,
	deadLetter: boolean,
	db: Db = createDb(),
): Promise<void> {
	await withTenantTransaction(db, row.companyId, (tx) => tx
		.update(notificationRows)
		.set({
			status: deadLetter ? "dead_letter" : "failed",
			lastError: error.slice(0, 500),
			nextAttemptAt,
		})
		.where(and(
			eq(notificationRows.companyId, row.companyId),
			eq(notificationRows.id, row.id),
			eq(notificationRows.status, "processing"),
		)));
}
