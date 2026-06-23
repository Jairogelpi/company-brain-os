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
