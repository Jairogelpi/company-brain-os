/**
 * Upload allow-list and content-type policy.
 *
 * Security notes:
 *  - SVG is deliberately NOT allowed (it can carry executable script → stored XSS).
 *  - Only known-safe types may be served `inline`; everything else is forced
 *    to download via Content-Disposition: attachment.
 */

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_MEDIA_BYTES =
	Number(process.env.MAX_MEDIA_BYTES) || 100 * 1024 * 1024; // 100 MB

// Allowed MIME → canonical extension. SVG intentionally excluded.
const ALLOWED: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/gif": "gif",
	"image/webp": "webp",
	"application/pdf": "pdf",
	"video/mp4": "mp4",
	"video/webm": "webm",
	"audio/mpeg": "mp3",
	"audio/wav": "wav",
	"audio/ogg": "ogg",
	"text/plain": "txt",
	"text/markdown": "md",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
	"application/vnd.ms-excel": "xls",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		"docx",
	"application/msword": "doc",
};

// Extensions we will serve inline (raster media + pdf + a/v). No svg, no html.
const INLINE_SAFE = new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"pdf",
	"mp4",
	"webm",
	"mp3",
	"wav",
	"ogg",
]);

const EXT_CONTENT_TYPE: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	pdf: "application/pdf",
	mp4: "video/mp4",
	webm: "video/webm",
	mp3: "audio/mpeg",
	wav: "audio/wav",
	ogg: "audio/ogg",
	txt: "text/plain; charset=utf-8",
	md: "text/markdown; charset=utf-8",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	xls: "application/vnd.ms-excel",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	doc: "application/msword",
};

export function isAllowedMime(mime: string): boolean {
	return mime in ALLOWED;
}

/** Canonical, safe extension for an allowed MIME type. */
export function extForMime(mime: string): string | null {
	return ALLOWED[mime] ?? null;
}

export function classifyMediaType(mime: string): string {
	if (mime.startsWith("image/")) return "image";
	if (mime.startsWith("video/")) return "video";
	if (mime.startsWith("audio/")) return "audio";
	return "document";
}

export function maxBytesForMime(mime: string): number {
	const mediaType = classifyMediaType(mime);
	return mediaType === "audio" || mediaType === "video"
		? MAX_MEDIA_BYTES
		: MAX_UPLOAD_BYTES;
}

export function contentTypeForExt(ext: string): string {
	return EXT_CONTENT_TYPE[ext] ?? "application/octet-stream";
}

export function isInlineSafe(ext: string): boolean {
	return INLINE_SAFE.has(ext);
}

function startsWith(buffer: Buffer, signature: number[], offset = 0): boolean {
	return signature.every((byte, index) => buffer[offset + index] === byte);
}

/** Verifies claimed MIME against file signatures before bytes reach storage. */
export function matchesMimeSignature(mime: string, buffer: Buffer): boolean {
	if (buffer.length === 0) return false;
	if (mime === "image/png") return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	if (mime === "image/jpeg") return startsWith(buffer, [0xff, 0xd8, 0xff]);
	if (mime === "image/gif") return buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a";
	if (mime === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
	if (mime === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
	if (mime === "video/mp4") return buffer.subarray(4, 8).toString("ascii") === "ftyp";
	if (mime === "video/webm") return startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3]);
	if (mime === "audio/mpeg") return buffer.subarray(0, 3).toString("ascii") === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
	if (mime === "audio/wav") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE";
	if (mime === "audio/ogg") return buffer.subarray(0, 4).toString("ascii") === "OggS";
	if (mime.includes("openxmlformats-officedocument")) return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
	if (mime === "application/msword" || mime === "application/vnd.ms-excel") {
		return startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
	}
	if (mime === "text/plain" || mime === "text/markdown") {
		return !buffer.subarray(0, Math.min(buffer.length, 8192)).includes(0);
	}
	return false;
}
