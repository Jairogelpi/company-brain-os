import { describe, expect, it, vi } from "vitest";
import { runNotificationWorkerOnce } from "./notification-worker";
import type { NotificationRow } from "./notifications";

function row(attempts = 1): NotificationRow {
	return {
		id: "notif-1",
		companyId: "org-1",
		recipientId: "laura",
		channel: "email",
		destination: "laura@example.com",
		title: "Mission",
		body: "Learn the filler setup",
		actionUrl: "/missions/mission-1",
		status: "processing",
		attempts,
		nextAttemptAt: new Date(),
		lastError: null,
		idempotencyKey: "assignment-1:email",
		createdAt: new Date(),
		deliveredAt: null,
		readAt: null,
	};
}

describe("notification worker", () => {
	it("marks provider-acknowledged deliveries complete", async () => {
		const complete = vi.fn().mockResolvedValue(undefined);
		const fail = vi.fn().mockResolvedValue(undefined);
		const deliver = vi.fn().mockResolvedValue(undefined);
		await runNotificationWorkerOnce({
			provider: { deliver },
			claim: vi.fn().mockResolvedValue([row()]),
			complete,
			fail,
		});
		expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ id: "notif-1" }));
		expect(complete).toHaveBeenCalledTimes(1);
		expect(fail).not.toHaveBeenCalled();
	});

	it("retries transient failure and dead-letters the eighth attempt", async () => {
		const fail = vi.fn().mockResolvedValue(undefined);
		await runNotificationWorkerOnce({
			provider: { deliver: vi.fn().mockRejectedValue(new Error("provider unavailable")) },
			claim: vi.fn().mockResolvedValue([row(8)]),
			complete: vi.fn(),
			fail,
		});
		expect(fail).toHaveBeenCalledWith(
			expect.objectContaining({ id: "notif-1" }),
			"provider unavailable",
			expect.any(Date),
			true,
		);
	});
});
