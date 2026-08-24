import { describe, expect, it, vi } from "vitest";
import {
	createEmailNotificationProvider,
	missionAssignmentNotifications,
	notificationRetryAt,
} from "./notifications";

describe("durable notifications", () => {
	it("creates an immediately visible in-app row and a pending email outbox row", () => {
		let id = 0;
		const rows = missionAssignmentNotifications({
			companyId: "org-1",
			recipientId: "laura",
			recipientEmail: "Laura@Example.com ",
			missionId: "mission-1",
			missionObjective: "Learn the filler setup",
			eventId: "assignment-1",
			now: new Date("2026-08-21T10:00:00.000Z"),
			id: () => String(++id),
		});

		expect(rows).toEqual([
			expect.objectContaining({ channel: "in_app", status: "delivered" }),
			expect.objectContaining({
				channel: "email",
				status: "pending",
				destination: "laura@example.com",
			}),
		]);
		expect(new Set(rows.map((row) => row.idempotencyKey)).size).toBe(2);
	});

	it("does not create an undeliverable email row when no address exists", () => {
		const rows = missionAssignmentNotifications({
			companyId: "org-1",
			recipientId: "laura",
			missionId: "mission-1",
			missionObjective: "Learn the filler setup",
			eventId: "assignment-1",
		});
		expect(rows.map((row) => row.channel)).toEqual(["in_app"]);
	});

	it("fails closed when the external email provider is not configured", async () => {
		const provider = createEmailNotificationProvider({} as NodeJS.ProcessEnv);
		await expect(provider.deliver({ id: "n-1", to: "a@example.com", title: "A", body: "B" }))
			.rejects.toThrow(/not configured/);
	});

	it("sends an idempotent authenticated webhook", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
		const provider = createEmailNotificationProvider({
			NODE_ENV: "test",
			APP_BASE_URL: "https://brain.example.test",
			NOTIFICATION_EMAIL_WEBHOOK_URL: "https://email.example.test/send",
			NOTIFICATION_EMAIL_WEBHOOK_TOKEN: "secret",
		} as NodeJS.ProcessEnv, fetchMock);
		await provider.deliver({ id: "n-1", to: "a@example.com", title: "A", body: "B", actionUrl: "/accept-invite?token=x" });
		expect(fetchMock).toHaveBeenCalledWith(
			"https://email.example.test/send",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					authorization: "Bearer secret",
					"idempotency-key": "n-1",
				}),
			}),
		);
		expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).actionUrl)
			.toBe("https://brain.example.test/accept-invite?token=x");
	});

	it("uses bounded exponential retry delays", () => {
		const now = new Date("2026-08-21T10:00:00.000Z");
		expect(notificationRetryAt(1, now).toISOString()).toBe("2026-08-21T10:00:30.000Z");
		expect(notificationRetryAt(20, now).toISOString()).toBe("2026-08-21T11:00:00.000Z");
	});
});
