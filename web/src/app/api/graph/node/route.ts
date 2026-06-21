import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { getGraphService } from "@/server/graph";

// Only these attribute keys may be set via this endpoint (cost model).
const COST_KEYS = new Set([
	"downtimeCostPerDay",
	"recoveryDays",
	"replacementCost",
	"replacementWeeks",
]);

/**
 * PATCH /api/graph/node — set a node's cost-model attributes (merged, not
 * overwritten). Requires contributor+ (graph.node.update). Used by the cost
 * editors so financial exposure stops being an estimate.
 */
export async function PATCH(request: Request) {
	const user = await requireApiUser("graph.node.update");
	if (user instanceof NextResponse) return user;

	let body: { id?: string; cost?: Record<string, unknown> };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	if (!body.id) {
		return NextResponse.json({ error: "id required" }, { status: 400 });
	}

	// Whitelist + validate: numbers ≥ 0 only.
	const patch: Record<string, number> = {};
	for (const [k, v] of Object.entries(body.cost ?? {})) {
		if (!COST_KEYS.has(k)) continue;
		const n = typeof v === "number" ? v : Number(v);
		if (!Number.isFinite(n) || n < 0) {
			return NextResponse.json({ error: `Invalid ${k}` }, { status: 400 });
		}
		patch[k] = n;
	}

	const service = getGraphService(user.companyId, user.id);
	const current = await service.readNode(body.id);
	if (!current) {
		return NextResponse.json({ error: "Node not found" }, { status: 404 });
	}

	const attributes = { ...(current.attributes ?? {}), ...patch };
	try {
		await service.updateNode(body.id, { attributes });
		return NextResponse.json({ ok: true, attributes });
	} catch (err) {
		return NextResponse.json({ error: (err as Error).message }, { status: 400 });
	}
}
