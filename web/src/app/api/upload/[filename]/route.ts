import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { getStorage } from "@/lib/storage";
import { contentTypeForExt, isInlineSafe } from "@/lib/upload-policy";
import { tenantStorageKey, verifySignedUploadUrl } from "@/lib/upload-security";
import { isStoredUploadAvailable } from "@/server/uploads";

// Stored filenames are always `<uuid>.<ext>` — validate that shape strictly.
const SAFE_NAME = /^[a-f0-9-]{36}\.[a-z0-9]+$/i;

/**
 * GET /api/upload/:filename — serve an uploaded file (authenticated).
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ filename: string }> },
) {
	const user = await requireApiUser();
	if (user instanceof NextResponse) return user;

	const { filename } = await params;
	if (!SAFE_NAME.test(filename)) {
		return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
	}
	if (!verifySignedUploadUrl(user.companyId, request.url)) {
		return NextResponse.json({ error: "Upload link is invalid or expired" }, { status: 403 });
	}
	if (!await isStoredUploadAvailable(user.companyId, filename)) {
		return NextResponse.json({ error: "File not found or retention expired" }, { status: 404 });
	}

	const buffer = await getStorage().get(tenantStorageKey(user.companyId, filename));
	if (!buffer) {
		return NextResponse.json({ error: "File not found" }, { status: 404 });
	}

	const ext = filename.split(".").pop()?.toLowerCase() ?? "";
	const contentType = contentTypeForExt(ext);
	// Only known-safe raster/pdf/av render inline; everything else downloads.
	const disposition = isInlineSafe(ext) ? "inline" : "attachment";

	return new NextResponse(new Uint8Array(buffer), {
		headers: {
			"Content-Type": contentType,
			"Content-Disposition": `${disposition}; filename="${filename}"`,
			// Defense in depth against content sniffing / embedded scripts.
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy": "default-src 'none'; sandbox",
			"Cache-Control": "private, no-store",
		},
	});
}
