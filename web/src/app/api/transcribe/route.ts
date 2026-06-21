import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { getStorage } from "@/lib/storage";
import { classifyMediaType, maxBytesForMime } from "@/lib/upload-policy";
import { createJob } from "@/server/transcription-jobs";

const SAFE_NAME = /^[a-f0-9-]{36}\.[a-z0-9]+$/i;

function isMedia(mimeType: string): boolean {
	const mediaType = classifyMediaType(mimeType);
	return mediaType === "audio" || mediaType === "video";
}

export async function POST(request: Request) {
	const user = await requireApiUser("graph.node.create");
	if (user instanceof NextResponse) return user;

	let body: { filename?: string; mimeType?: string; source?: string };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const filename = body.filename?.trim() ?? "";
	const mimeType = body.mimeType?.trim() ?? "";
	if (!SAFE_NAME.test(filename)) {
		return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
	}
	if (!isMedia(mimeType)) {
		return NextResponse.json({ error: "Only audio/video can be transcribed" }, { status: 400 });
	}

	const storage = getStorage();
	const size = await storage.size(filename);
	if (size === null) {
		return NextResponse.json({ error: "File not found" }, { status: 404 });
	}
	const maxBytes = maxBytesForMime(mimeType);
	if (size > maxBytes) {
		return NextResponse.json(
			{ error: `File too large. Max ${maxBytes / 1024 / 1024} MB.` },
			{ status: 413 },
		);
	}

	const job = await createJob({
		companyId: user.companyId,
		userId: user.id,
		source: body.source?.trim() || filename,
		storageKey: filename,
		mimeType,
	});

	return NextResponse.json({
		jobId: job.id,
		status: job.status,
		statusUrl: `/api/transcribe/jobs/${job.id}`,
	});
}
