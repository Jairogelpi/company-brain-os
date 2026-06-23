import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { getGraphService } from "@/server/graph";
import { isEdgeType, type EdgeType, type GraphEdge } from "@/domain/graph";

/**
 * POST /api/graph/edge — create a relationship. Requires contributor+.
 * Body: { type, fromNodeId, toNodeId }. The service validates endpoint rules
 * (canConnect) and rejects invalid combinations with a 400.
 */
export async function POST(request: Request) {
	const user = await requireApiUser("graph.edge.create");
	if (user instanceof NextResponse) return user;

	let body: { type?: string; fromNodeId?: string; toNodeId?: string };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const { type, fromNodeId, toNodeId } = body;
	if (!isEdgeType(type ?? "")) {
		return NextResponse.json({ error: "Invalid edge type" }, { status: 400 });
	}
	if (!fromNodeId || !toNodeId) {
		return NextResponse.json(
			{ error: "fromNodeId and toNodeId are required" },
			{ status: 400 },
		);
	}
	if (fromNodeId === toNodeId) {
		return NextResponse.json(
			{ error: "A node cannot connect to itself" },
			{ status: 400 },
		);
	}

	const edge: GraphEdge = {
		id: `edge-${globalThis.crypto.randomUUID()}`,
		type: type as EdgeType,
		fromNodeId,
		toNodeId,
	};

	const service = getGraphService(user.companyId, user.id);
	try {
		await service.createEdge(edge);
		return NextResponse.json({ edge });
	} catch (err) {
		return NextResponse.json({ error: (err as Error).message }, { status: 400 });
	}
}

/**
 * DELETE /api/graph/edge?id=… — remove a relationship. Requires validator+.
 */
export async function DELETE(request: Request) {
	const user = await requireApiUser("graph.edge.delete");
	if (user instanceof NextResponse) return user;

	const id = new URL(request.url).searchParams.get("id");
	if (!id) {
		return NextResponse.json({ error: "id required" }, { status: 400 });
	}

	const service = getGraphService(user.companyId, user.id);
	try {
		await service.deleteEdge(id);
		return NextResponse.json({ ok: true });
	} catch (err) {
		return NextResponse.json({ error: (err as Error).message }, { status: 400 });
	}
}
