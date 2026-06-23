import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { getGraphService } from "@/server/graph";
import {
	isNodeType,
	isKnowledgeType,
	type GraphNode,
	type KnowledgeNode,
} from "@/domain/graph";

// Cost-model attribute keys (financial exposure).
const COST_KEYS = new Set([
	"downtimeCostPerDay",
	"recoveryDays",
	"replacementCost",
	"replacementWeeks",
]);

const CRITICALITY = new Set(["low", "medium", "high"]);
const VALIDATION = new Set(["draft", "proposed", "validated", "retired"]);

function slug(s: string): string {
	return (
		s
			.normalize("NFD")
			.replace(/[̀-ͯ]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "")
			.slice(0, 40) || "node"
	);
}

/**
 * POST /api/graph/node — create a node. Requires contributor+.
 * Body: { type, name, criticality?, knowledgeType?, x?, y? }.
 * Knowledge nodes get sane defaults (documented=false, proposed, confidence 25).
 */
export async function POST(request: Request) {
	const user = await requireApiUser("graph.node.create");
	if (user instanceof NextResponse) return user;

	let body: {
		type?: string;
		name?: string;
		criticality?: string;
		knowledgeType?: string;
		x?: number;
		y?: number;
	};
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const type = body.type ?? "";
	const name = (body.name ?? "").trim();
	if (!isNodeType(type)) {
		return NextResponse.json({ error: "Invalid node type" }, { status: 400 });
	}
	if (!name) {
		return NextResponse.json({ error: "name is required" }, { status: 400 });
	}

	const id = `${type.toLowerCase()}-${slug(name)}-${globalThis.crypto
		.randomUUID()
		.slice(0, 4)}`;

	const attributes: Record<string, unknown> = {};
	if (typeof body.x === "number") attributes.x = body.x;
	if (typeof body.y === "number") attributes.y = body.y;

	let node: GraphNode | KnowledgeNode = {
		id,
		type,
		name,
		...(CRITICALITY.has(body.criticality ?? "")
			? { criticality: body.criticality as GraphNode["criticality"] }
			: {}),
		...(Object.keys(attributes).length ? { attributes } : {}),
	};
	if (type === "Knowledge") {
		node = {
			...node,
			type: "Knowledge",
			knowledgeType: isKnowledgeType(body.knowledgeType ?? "")
				? (body.knowledgeType as KnowledgeNode["knowledgeType"])
				: "technical",
			documented: false,
			validationState: "proposed",
			confidence: 25,
		} as KnowledgeNode;
	}

	const service = getGraphService(user.companyId, user.id);
	try {
		await service.createNode(node);
		return NextResponse.json({ node });
	} catch (err) {
		return NextResponse.json({ error: (err as Error).message }, { status: 400 });
	}
}

/**
 * PATCH /api/graph/node — update a node. Requires contributor+.
 * Body: { id, patch?: {...whitelisted fields}, position?: {x,y}, cost?: {...} }.
 * Top-level fields, plus position and cost merged into `attributes`.
 */
export async function PATCH(request: Request) {
	const user = await requireApiUser("graph.node.update");
	if (user instanceof NextResponse) return user;

	let body: {
		id?: string;
		patch?: Record<string, unknown>;
		position?: { x?: number; y?: number };
		cost?: Record<string, unknown>;
	};
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	if (!body.id) {
		return NextResponse.json({ error: "id required" }, { status: 400 });
	}

	const service = getGraphService(user.companyId, user.id);
	const current = await service.readNode(body.id);
	if (!current) {
		return NextResponse.json({ error: "Node not found" }, { status: 404 });
	}

	const patch: Partial<GraphNode | KnowledgeNode> = {};
	const src = body.patch ?? {};

	if (typeof src.name === "string" && src.name.trim()) {
		patch.name = src.name.trim();
	}
	if (typeof src.criticality === "string" && CRITICALITY.has(src.criticality)) {
		patch.criticality = src.criticality as GraphNode["criticality"];
	}
	if (current.type === "Knowledge") {
		const k = patch as Partial<KnowledgeNode>;
		if (typeof src.knowledgeType === "string" && isKnowledgeType(src.knowledgeType)) {
			k.knowledgeType = src.knowledgeType as KnowledgeNode["knowledgeType"];
		}
		if (typeof src.documented === "boolean") k.documented = src.documented;
		if (typeof src.validationState === "string" && VALIDATION.has(src.validationState)) {
			k.validationState = src.validationState as KnowledgeNode["validationState"];
		}
		if (typeof src.confidence === "number" && src.confidence >= 0 && src.confidence <= 100) {
			k.confidence = src.confidence;
		}
	}

	// Attribute merge: position + cost (numbers ≥ 0 only).
	const attrPatch: Record<string, number> = {};
	if (typeof body.position?.x === "number") attrPatch.x = body.position.x;
	if (typeof body.position?.y === "number") attrPatch.y = body.position.y;
	for (const [k, v] of Object.entries(body.cost ?? {})) {
		if (!COST_KEYS.has(k)) continue;
		const n = typeof v === "number" ? v : Number(v);
		if (!Number.isFinite(n) || n < 0) {
			return NextResponse.json({ error: `Invalid ${k}` }, { status: 400 });
		}
		attrPatch[k] = n;
	}
	if (Object.keys(attrPatch).length) {
		patch.attributes = { ...(current.attributes ?? {}), ...attrPatch };
	}

	try {
		await service.updateNode(body.id, patch);
		return NextResponse.json({ ok: true });
	} catch (err) {
		return NextResponse.json({ error: (err as Error).message }, { status: 400 });
	}
}

/**
 * DELETE /api/graph/node?id=… — delete a node (cascades its edges).
 * Requires validator+ (graph.node.delete).
 */
export async function DELETE(request: Request) {
	const user = await requireApiUser("graph.node.delete");
	if (user instanceof NextResponse) return user;

	const id = new URL(request.url).searchParams.get("id");
	if (!id) {
		return NextResponse.json({ error: "id required" }, { status: 400 });
	}

	const service = getGraphService(user.companyId, user.id);
	try {
		await service.deleteNode(id);
		return NextResponse.json({ ok: true });
	} catch (err) {
		return NextResponse.json({ error: (err as Error).message }, { status: 400 });
	}
}
