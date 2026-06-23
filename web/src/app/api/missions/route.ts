import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import {
	assignMission,
	listMissions,
	listSubmissions,
	saveMissions,
	transitionMissionStatus,
} from "@/server/missions";
import type { MissionStatus } from "@/domain/missions";
import type { Criticality } from "@/domain/graph";

type ActionInput = {
	knowledgeId: string;
	knowledgeName: string;
	criticality: Criticality | null;
	action: string;
	targetDate?: string;
	detailedSteps?: string[];
	suggestedTrainerId?: string;
	suggestedTrainerName?: string;
	rationale?: string;
	riskNote?: string;
};

const PRIORITY: Record<string, "low" | "medium" | "high" | "critical"> = {
	high: "high",
	medium: "medium",
	low: "low",
};

/** GET /api/missions — list the company's missions + their submissions. */
export async function GET() {
	const user = await requireApiUser();
	if (user instanceof NextResponse) return user;
	const [items, submissions] = await Promise.all([
		listMissions(user.companyId),
		listSubmissions(user.companyId),
	]);
	return NextResponse.json({ items, submissions, count: items.length });
}

/** POST /api/missions — persist a generated playbook as missions. */
export async function POST(request: Request) {
	const user = await requireApiUser("mission.create");
	if (user instanceof NextResponse) return user;

	let body: { personId?: string; actions?: ActionInput[] };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	const actions = Array.isArray(body.actions) ? body.actions : [];
	if (actions.length === 0) {
		return NextResponse.json({ error: "No actions" }, { status: 400 });
	}

	const rows = actions.map((a) => ({
		id: `mission-${globalThis.crypto.randomUUID()}`,
		objective: a.action,
		targetNodeId: a.knowledgeId,
		targetNodeName: a.knowledgeName,
		priority: PRIORITY[a.criticality ?? "medium"] ?? "medium",
		dueDate: a.targetDate,
		createdBy: user.id,
		detailedSteps: a.detailedSteps,
		suggestedTrainerId: a.suggestedTrainerId,
		suggestedTrainerName: a.suggestedTrainerName,
		rationale: a.rationale,
		riskNote: a.riskNote,
	}));
	const saved = await saveMissions(user.companyId, body.personId, rows);
	return NextResponse.json({ saved });
}

/**
 * PATCH /api/missions — assign (assigneeId/instructions) and/or transition a
 * mission's status. Requires mission.assign (validator+).
 */
export async function PATCH(request: Request) {
	const user = await requireApiUser("mission.assign");
	if (user instanceof NextResponse) return user;

	let body: {
		id?: string;
		to?: MissionStatus;
		assigneeId?: string;
		instructions?: string;
	};
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	if (!body.id) {
		return NextResponse.json({ error: "id required" }, { status: 400 });
	}
	try {
		if (body.assigneeId !== undefined || body.instructions !== undefined) {
			await assignMission(user.companyId, body.id, {
				assigneeId: body.assigneeId,
				instructions: body.instructions,
			});
		}
		const mission = body.to
			? await transitionMissionStatus(user.companyId, body.id, body.to)
			: undefined;
		return NextResponse.json({ ok: true, mission });
	} catch (err) {
		return NextResponse.json(
			{ error: (err as Error).message },
			{ status: 400 },
		);
	}
}
