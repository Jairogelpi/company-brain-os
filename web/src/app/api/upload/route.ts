import { NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { requireApiUser } from "@/auth/api-guard";
import { checkDistributedRateLimit } from "@/lib/rate-limiter";
import { getStorage } from "@/lib/storage";
import {
	classifyMediaType,
	extForMime,
	isAllowedMime,
	maxBytesForMime,
	matchesMimeSignature,
} from "@/lib/upload-policy";
import {
	createSignedUploadUrl,
	scanUpload,
	tenantStorageKey,
} from "@/lib/upload-security";
import { registerStoredUpload } from "@/server/uploads";

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
	let rl;
	try {
		rl = await checkDistributedRateLimit(`upload:${user.companyId}:${user.id}`, 30, 10);
	} catch {
		return NextResponse.json({ error: "Upload service temporarily unavailable" }, { status: 503 });
	}
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
		if (!matchesMimeSignature(mimeType, buffer)) {
			return NextResponse.json({ error: "File content does not match its declared type" }, { status: 415 });
		}
		let scan;
		try {
			scan = await scanUpload(buffer);
		} catch {
			return NextResponse.json({ error: "Malware scanner unavailable" }, { status: 503 });
		}
		if (!scan.clean) {
			return NextResponse.json({ error: "Upload rejected by malware scanner" }, { status: 422 });
		}
		const storageKey = tenantStorageKey(user.companyId, safeName);
		const storage = getStorage();
		await storage.put(storageKey, buffer, mimeType);
		const contentSha256 = createHash("sha256").update(buffer).digest("hex");
		const uploadId = randomUUID();
		const configuredRetentionDays = Number(process.env.UPLOAD_RETENTION_DAYS) || 365;
		const retentionDays = Math.max(1, Math.min(configuredRetentionDays, 3650));
		const retentionUntil = new Date(Date.now() + retentionDays * 86_400_000);
		try {
			await registerStoredUpload({
				id: uploadId,
				companyId: user.companyId,
				filename: safeName,
				originalName: file.name || safeName,
				mimeType,
				sizeBytes: file.size,
				contentSha256,
				uploadedBy: user.id,
				scanProvider: scan.provider,
				retentionUntil,
			});
		} catch (error) {
			await storage.delete(storageKey).catch(() => undefined);
			throw error;
		}

		return NextResponse.json({
			id: uploadId,
			filename: safeName,
			originalName: file.name || safeName,
			storageUrl: createSignedUploadUrl(user.companyId, safeName),
			mediaType: classifyMediaType(mimeType),
			mimeType,
			size: file.size,
			contentSha256,
			scanProvider: scan.provider,
			retentionUntil: retentionUntil.toISOString(),
		});
	} catch (error) {
		console.error("Upload error:", error);
		return NextResponse.json({ error: "Upload failed" }, { status: 500 });
	}
}
