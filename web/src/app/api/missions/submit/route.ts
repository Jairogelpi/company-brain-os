import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { canPerform } from "@/auth/permissions";
import { createSubmission, readMission } from "@/server/missions";

/**
 * POST /api/missions/submit — an employee delivers work for a mission.
 * Body: { missionId, kind: "file"|"text", text?, storageUrl?, fileName?,
 *         mimeType?, mediaType? }. The uploaded file (if any) is created first
 * via /api/upload; this only records the deliverable + moves the mission to
 * "submitted" for review.
 *
 * Allowed for the assigned employee, or any contributor+ if unassigned.
 */
export async function POST(request: Request) {
	const user = await requireApiUser();
	if (user instanceof NextResponse) return user;

	let body: {
		missionId?: string;
		kind?: "file" | "text";
		text?: string;
		storageUrl?: string;
		fileName?: string;
		mimeType?: string;
		mediaType?: string;
	};
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	if (!body.missionId) {
		return NextResponse.json({ error: "missionId required" }, { status: 400 });
	}
	const mission = await readMission(user.companyId, body.missionId);
	if (!mission) {
		return NextResponse.json({ error: "Mission not found" }, { status: 404 });
	}

	const isAssignee = mission.assigneeId === user.id;
	if (!isAssignee && !canPerform(user, "graph.node.create")) {
		return NextResponse.json(
			{ error: "This mission is assigned to someone else." },
			{ status: 403 },
		);
	}

	const kind = body.kind === "file" ? "file" : "text";
	if (kind === "text" && !(body.text ?? "").trim()) {
		return NextResponse.json({ error: "Write something first." }, { status: 400 });
	}
	if (kind === "file" && !body.storageUrl) {
		return NextResponse.json({ error: "Upload a file first." }, { status: 400 });
	}

	const submission = await createSubmission(user.companyId, {
		missionId: body.missionId,
		authorId: user.id,
		kind,
		text: kind === "text" ? body.text?.trim() : undefined,
		storageUrl: kind === "file" ? body.storageUrl : undefined,
		fileName: body.fileName,
		mimeType: body.mimeType,
		mediaType: body.mediaType,
	});

	return NextResponse.json({ submission });
}
