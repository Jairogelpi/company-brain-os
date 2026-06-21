import { describe, expect, it, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limiter";
import {
	sendNotification,
	notifyMissionAssigned,
	getNotifications,
	clearNotifications,
} from "@/lib/notifications";
import {
	createCompany,
	getCompany,
	listCompanies,
	companyExists,
} from "@/domain/company-service";
import { createTranscriptionService } from "@/ai/transcription";

describe("Rate Limiter", () => {
	beforeEach(() => resetRateLimits());

	it("allows requests within rate limit", () => {
		for (let i = 0; i < 10; i++) {
			const result = checkRateLimit("user-1");
			expect(result.allowed).toBe(true);
		}
	});

	it("respects custom rate and capacity", () => {
		const result = checkRateLimit("user-2", 1, 1);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(0);

		// Next request should be denied
		const denied = checkRateLimit("user-2", 1, 1);
		expect(denied.allowed).toBe(false);
		expect(denied.retryAfter).toBeGreaterThan(0);
	});

	it("returns retry-after in seconds", () => {
		// Exhaust the bucket
		checkRateLimit("user-3", 1, 1);
		const denied = checkRateLimit("user-3", 1, 1);
		expect(denied.retryAfter).toBeGreaterThan(0);
	});

	it("isolates rate limits per key", () => {
		checkRateLimit("user-a", 1, 1);
		const result = checkRateLimit("user-b", 10, 10);
		expect(result.allowed).toBe(true);
	});
});

describe("Notifications", () => {
	beforeEach(() => clearNotifications());

	it("sends a notification and marks it as sent", () => {
		const notif = sendNotification({
			recipientId: "pedro",
			channel: "email",
			title: "Test",
			body: "Test body",
		});

		expect(notif.id).toContain("notif-");
		expect(notif.title).toBe("Test");
		expect(notif.recipientId).toBe("pedro");
	});

	it("notifyMissionAssigned creates a mission notification", () => {
		const notif = notifyMissionAssigned(
			"pedro",
			"pedro@test.com",
			"Document filler",
			"mission-1",
		);

		expect(notif.title).toContain("mission");
		expect(notif.body).toContain("Document filler");
		expect(notif.actionUrl).toBe("/missions/mission-1");
	});

	it("retrieves notifications by recipient", () => {
		sendNotification({
			recipientId: "pedro",
			channel: "in_app",
			title: "A",
			body: "A",
		});
		sendNotification({
			recipientId: "laura",
			channel: "in_app",
			title: "B",
			body: "B",
		});
		sendNotification({
			recipientId: "pedro",
			channel: "in_app",
			title: "C",
			body: "C",
		});

		const pedroNotifs = getNotifications("pedro");
		expect(pedroNotifs).toHaveLength(2);
	});
});

describe("Multi-company", () => {
	it("creates a company with slug", () => {
		const company = createCompany("Acme Corporation");
		expect(company.id).toBe("company-acme-corporation");
		expect(company.slug).toBe("acme-corporation");
		expect(company.name).toBe("Acme Corporation");
	});

	it("demo company exists by default", () => {
		expect(companyExists("demo-corp")).toBe(true);
		const demo = getCompany("demo-corp");
		expect(demo?.name).toBe("Demo Corporation");
	});

	it("lists all companies", () => {
		createCompany("Alpha");
		createCompany("Beta");
		expect(listCompanies().length).toBeGreaterThanOrEqual(3); // demo + alpha + beta
	});

	it("returns undefined for unknown company", () => {
		expect(getCompany("nonexistent")).toBeUndefined();
		expect(companyExists("nonexistent")).toBe(false);
	});
});

describe("Transcription", () => {
	it("transcription service degrades explicitly when disabled", async () => {
		const service = createTranscriptionService({ TRANSCRIPTION_PROVIDER: "none" });
		const result = await service.transcribe("test.mp3", "audio/mpeg");

		expect(result).toEqual({
			text: "",
			language: "unknown",
			confidence: 0,
			provider: "unavailable",
		});
	});

	it("transcribeBuffer also degrades explicitly when disabled", async () => {
		const service = createTranscriptionService({ TRANSCRIPTION_PROVIDER: "none" });
		const result = await service.transcribeBuffer(Buffer.from("test"), "audio/wav");

		expect(result.provider).toBe("unavailable");
		expect(result.text).toBe("");
	});
});
