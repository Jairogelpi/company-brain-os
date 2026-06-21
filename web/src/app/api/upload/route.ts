import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireApiUser } from "@/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limiter";
import { getStorage } from "@/lib/storage";
import {
	classifyMediaType,
	extForMime,
	isAllowedMime,
	maxBytesForMime,
} from "@/lib/upload-policy";

/**
 * POST /api/upload
 *
 * Requires authentication. Accepts a single file (multipart/form-data),
 * validated against an allow-list, and stores it via the storage adapter.
 * Returns: { id, filename, storageUrl, mediaType, mimeType, size }
 */
export async function POST(request: Request) {
	const user = await requireApiUser();
	if (user instanceof NextResponse) return user;

	// Rate limit uploads per user (10 burst, refill 30/min).
	const rl = checkRateLimit(`upload:${user.id}`, 30, 10);
	if (!rl.allowed) {
		return NextResponse.json(
			{ error: "Too many uploads. Slow down." },
			{ status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
		);
	}

	try {
		const formData = await request.formData();
		const file = formData.get("file") as File | null;

		if (!file) {
			return NextResponse.json({ error: "No file provided" }, { status: 400 });
		}

		const mimeType = file.type || "application/octet-stream";
		const maxBytes = maxBytesForMime(mimeType);
		if (file.size > maxBytes) {
			return NextResponse.json(
				{ error: `File too large. Max ${maxBytes / 1024 / 1024} MB.` },
				{ status: 413 },
			);
		}

		if (!isAllowedMime(mimeType)) {
			return NextResponse.json(
				{ error: `Unsupported file type: ${mimeType}` },
				{ status: 415 },
			);
		}

		// Filename is fully server-generated — never trust client input.
		const ext = extForMime(mimeType);
		const safeName = `${randomUUID()}.${ext}`;

		const buffer = Buffer.from(await file.arrayBuffer());
		await getStorage().put(safeName, buffer, mimeType);

		return NextResponse.json({
			id: randomUUID(),
			filename: safeName,
			originalName: file.name || safeName,
			storageUrl: `/api/upload/${safeName}`,
			mediaType: classifyMediaType(mimeType),
			mimeType,
			size: file.size,
		});
	} catch (error) {
		console.error("Upload error:", error);
		return NextResponse.json({ error: "Upload failed" }, { status: 500 });
	}
}
