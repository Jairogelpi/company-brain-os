import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { getJob } from "@/server/transcription-jobs";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await requireApiUser();
	if (user instanceof NextResponse) return user;

	const { id } = await params;
	const job = await getJob(id, user.companyId);
	if (!job || job.companyId !== user.companyId) {
		return NextResponse.json({ error: "Job not found" }, { status: 404 });
	}

	const payload: Record<string, unknown> = {
		id: job.id,
		status: job.status,
		updatedAt: job.updatedAt.toISOString(),
	};

	if (job.status === "completed") {
		payload.transcript = job.transcript ?? "";
		payload.noSpeech = job.noSpeech;
		payload.provider = job.provider;
	}
	if (job.status === "failed") {
		payload.failReason = job.failReason ?? "transcription failed";
		payload.provider = job.provider;
	}

	return NextResponse.json(payload);
}
