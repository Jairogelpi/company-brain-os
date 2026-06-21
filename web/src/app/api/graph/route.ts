import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { getGraphService } from "@/server/graph";
import { seedDemoGraph } from "@/domain/seed-graph";

/**
 * GET /api/graph — returns the authenticated user's company graph from the DB.
 */
export async function GET() {
	const user = await requireApiUser();
	if (user instanceof NextResponse) return user;

	const service = getGraphService(user.companyId, user.id);
	const [nodes, edges] = await Promise.all([
		service.listNodes(),
		service.listEdges(),
	]);
	return NextResponse.json({ nodes, edges });
}

/**
 * POST /api/graph — seeds the demo graph for this company (idempotent).
 * Restricted to owners.
 */
export async function POST() {
	const user = await requireApiUser("user.invite"); // owner-only operation
	if (user instanceof NextResponse) return user;

	const service = getGraphService(user.companyId, user.id);
	const result = await seedDemoGraph(service);
	return NextResponse.json(result);
}
