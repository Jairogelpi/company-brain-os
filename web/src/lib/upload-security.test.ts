import { afterEach, describe, expect, it } from "vitest";
import {
	createSignedUploadUrl,
	scanUpload,
	tenantStorageKey,
	verifySignedUploadUrl,
} from "./upload-security";

describe("upload tenant and malware security", () => {
	afterEach(() => {
		delete process.env.MALWARE_SCAN_MODE;
	});

	it("uses different unguessable storage partitions for the same filename", () => {
		const filename = "00000000-0000-4000-8000-000000000001.pdf";
		const first = tenantStorageKey("org-a", filename);
		const second = tenantStorageKey("org-b", filename);

		expect(first).not.toBe(second);
		expect(first).not.toContain("org-a");
		expect(() => tenantStorageKey("org-a", "../secret")).toThrow("Invalid filename");
	});

	it("rejects the standard antivirus test signature before storage", async () => {
		process.env.MALWARE_SCAN_MODE = "basic";
		const result = await scanUpload(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"));

		expect(result).toEqual({ clean: false, provider: "basic", signature: "Eicar-Test-Signature" });
	});

	it("binds short-lived download links to tenant, filename and expiry", () => {
		const now = new Date("2026-08-01T00:00:00.000Z").getTime();
		const url = createSignedUploadUrl(
			"org-a",
			"00000000-0000-4000-8000-000000000001.pdf",
			now,
			60,
		);

		expect(verifySignedUploadUrl("org-a", url, now + 30_000)).toBe(true);
		expect(verifySignedUploadUrl("org-b", url, now + 30_000)).toBe(false);
		expect(verifySignedUploadUrl("org-a", url, now + 61_000)).toBe(false);
		expect(verifySignedUploadUrl("org-a", `${url}tampered`, now)).toBe(false);
	});
});
