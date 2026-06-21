import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import {
	listMissions,
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

/** GET /api/missions — list the company's missions. */
export async function GET() {
	const user = await requireApiUser();
	if (user instanceof NextResponse) return user;
	const items = await listMissions(user.companyId);
	return NextResponse.json({ items, count: items.length });
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

/** PATCH /api/missions — transition a mission's status. */
export async function PATCH(request: Request) {
	const user = await requireApiUser("mission.create");
	if (user instanceof NextResponse) return user;

	let body: { id?: string; to?: MissionStatus };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	if (!body.id || !body.to) {
		return NextResponse.json({ error: "id and to required" }, { status: 400 });
	}
	try {
		const mission = await transitionMissionStatus(
			user.companyId,
			body.id,
			body.to,
		);
		return NextResponse.json({ mission });
	} catch (err) {
		return NextResponse.json({ error: (err as Error).message }, { status: 400 });
	}
}
