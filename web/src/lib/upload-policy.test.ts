import { describe, expect, it } from "vitest";
import {
	isAllowedMime,
	extForMime,
	classifyMediaType,
	isInlineSafe,
	contentTypeForExt,
	maxBytesForMime,
	MAX_MEDIA_BYTES,
	MAX_UPLOAD_BYTES,
} from "./upload-policy";

describe("upload policy", () => {
	it("allows known-safe types", () => {
		expect(isAllowedMime("image/png")).toBe(true);
		expect(isAllowedMime("application/pdf")).toBe(true);
		expect(extForMime("image/png")).toBe("png");
	});

	it("blocks SVG (stored XSS vector)", () => {
		expect(isAllowedMime("image/svg+xml")).toBe(false);
		expect(extForMime("image/svg+xml")).toBeNull();
		expect(isInlineSafe("svg")).toBe(false);
	});

	it("blocks arbitrary/dangerous types", () => {
		expect(isAllowedMime("text/html")).toBe(false);
		expect(isAllowedMime("application/javascript")).toBe(false);
		expect(isAllowedMime("application/octet-stream")).toBe(false);
	});

	it("only serves raster/pdf/av inline", () => {
		expect(isInlineSafe("png")).toBe(true);
		expect(isInlineSafe("pdf")).toBe(true);
		expect(isInlineSafe("mp4")).toBe(true);
		// documents download instead of rendering inline
		expect(isInlineSafe("txt")).toBe(false);
		expect(isInlineSafe("xlsx")).toBe(false);
	});

	it("classifies media types", () => {
		expect(classifyMediaType("image/png")).toBe("image");
		expect(classifyMediaType("audio/mpeg")).toBe("audio");
		expect(classifyMediaType("application/pdf")).toBe("document");
	});

	it("maps extensions to content types with charset for text", () => {
		expect(contentTypeForExt("png")).toBe("image/png");
		expect(contentTypeForExt("txt")).toContain("charset=utf-8");
		expect(contentTypeForExt("unknown")).toBe("application/octet-stream");
	});

	it("uses larger media limits without raising document limits", () => {
		expect(maxBytesForMime("audio/mpeg")).toBe(MAX_MEDIA_BYTES);
		expect(maxBytesForMime("video/webm")).toBe(MAX_MEDIA_BYTES);
		expect(maxBytesForMime("text/csv")).toBe(MAX_UPLOAD_BYTES);
	});
});
