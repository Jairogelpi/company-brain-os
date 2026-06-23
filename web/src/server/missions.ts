import { and, eq } from "drizzle-orm";
import { createDb } from "@/db";
import { missions } from "@/db/schema";
import {
	VALID_TRANSITIONS,
	type Mission,
	type MissionStatus,
} from "@/domain/missions";

/** DB-backed missions, scoped to a company (tenant). */

type Row = typeof missions.$inferSelect;

export function rowToMission(r: Row): Mission {
	return {
		id: r.id,
		objective: r.objective,
		targetNodeId: r.targetNodeId,
		targetNodeName: r.targetNodeName,
		assigneeIds: r.assigneeIds,
		priority: r.priority,
		dueDate: r.dueDate ?? undefined,
		status: r.status,
		createdBy: r.createdBy,
		createdAt: r.createdAt.toISOString(),
		closedAt: r.closedAt?.toISOString(),
		detailedSteps: r.detailedSteps ?? undefined,
		suggestedTrainerId: r.suggestedTrainerId ?? undefined,
		suggestedTrainerName: r.suggestedTrainerName ?? undefined,
		rationale: r.rationale ?? undefined,
		riskNote: r.riskNote ?? undefined,
	};
}

export async function saveMissions(
	companyId: string,
	personId: string | undefined,
	rows: Array<{
		id: string;
		objective: string;
		targetNodeId: string;
		targetNodeName: string;
		priority: "low" | "medium" | "high" | "critical";
		dueDate?: string;
		createdBy: string;
		detailedSteps?: string[];
		suggestedTrainerId?: string;
		suggestedTrainerName?: string;
		rationale?: string;
		riskNote?: string;
	}>,
): Promise<number> {
	if (rows.length === 0) return 0;
	await createDb()
		.insert(missions)
		.values(
			rows.map((r) => ({ ...r, companyId, personId, status: "open" as const })),
		);
	return rows.length;
}

export async function listMissions(companyId: string): Promise<Mission[]> {
	const rows = await createDb()
		.select()
		.from(missions)
		.where(eq(missions.companyId, companyId))
		.orderBy(missions.createdAt);
	return rows.map(rowToMission);
}

/** Transition a mission, enforcing the domain's allowed transitions + tenancy. */
export async function transitionMissionStatus(
	companyId: string,
	id: string,
	to: MissionStatus,
): Promise<Mission> {
	const db = createDb();
	const rows = await db
		.select()
		.from(missions)
		.where(and(eq(missions.companyId, companyId), eq(missions.id, id)))
		.limit(1);
	const current = rows[0];
	if (!current) throw new Error(`Mission not found: ${id}`);
	if (!VALID_TRANSITIONS[current.status].includes(to)) {
		throw new Error(
			`Invalid transition ${current.status} → ${to}. Valid: ${
				VALID_TRANSITIONS[current.status].join(", ") || "none"
			}`,
		);
	}
	await db
		.update(missions)
		.set({
			status: to,
			closedAt: to === "closed" ? new Date() : current.closedAt,
		})
		.where(and(eq(missions.companyId, companyId), eq(missions.id, id)));
	return rowToMission({ ...current, status: to });
}
