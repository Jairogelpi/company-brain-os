import { describe, expect, it, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limiter";
import { missionAssignmentNotifications } from "@/lib/notifications";
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
	it("builds durable in-app and email outbox records", () => {
		const notifications = missionAssignmentNotifications({
			companyId: "company-a",
			recipientId: "pedro",
			recipientEmail: "pedro@test.com",
			missionObjective: "Document filler",
			missionId: "mission-1",
			eventId: "assignment-1",
		});

		expect(notifications).toHaveLength(2);
		expect(notifications.find((item) => item.channel === "in_app")?.status)
			.toBe("delivered");
		expect(notifications.find((item) => item.channel === "email")?.status)
			.toBe("pending");
	});
});

describe("Multi-company", () => {
	it("creates a company with slug", () => {
		const company = createCompany("Acme Corporation");
		expect(company.id).toBe("company-acme-corporation");
		expect(company.slug).toBe("acme-corporation");
		expect(company.name).toBe("Acme Corporation");
	});

	it("does not create a demo company by default", () => {
		expect(companyExists("demo-corp")).toBe(false);
		expect(getCompany("demo-corp")).toBeUndefined();
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
		const service = createTranscriptionService({
			TRANSCRIPTION_PROVIDER: "none",
		});
		const result = await service.transcribe("test.mp3", "audio/mpeg");

		expect(result).toEqual({
			text: "",
			language: "unknown",
			confidence: 0,
			provider: "unavailable",
		});
	});

	it("transcribeBuffer also degrades explicitly when disabled", async () => {
		const service = createTranscriptionService({
			TRANSCRIPTION_PROVIDER: "none",
		});
		const result = await service.transcribeBuffer(
			Buffer.from("test"),
			"audio/wav",
		);

		expect(result.provider).toBe("unavailable");
		expect(result.text).toBe("");
	});
});
