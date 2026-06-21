import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { getGraphService } from "@/server/graph";
import { savePending } from "@/server/ingestion";
import {
	mapEmployeeRows,
	ingestText,
	parseEmployeeCsv,
	type EmployeeRow,
	type IngestResult,
} from "@/domain/ingest";

/**
 * POST /api/ingest — auto-map existing data into the review queue.
 * Body: { source, csv?: string, rows?: EmployeeRow[], text?: string }.
 * Generates proposals (no graph writes) and stores them as PENDING for review.
 * Requires contributor+ (graph.node.create).
 */
export async function POST(request: Request) {
	const user = await requireApiUser("graph.node.create");
	if (user instanceof NextResponse) return user;

	let body: {
		source?: string;
		csv?: string;
		rows?: EmployeeRow[];
		text?: string;
	};
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const source = body.source?.trim() || "upload";
	const service = getGraphService(user.companyId, user.id);
	const existingNodeIds = new Set((await service.listNodes()).map((n) => n.id));

	let result: IngestResult;
	let kind: "csv" | "text";
	try {
		if (typeof body.text === "string") {
			kind = "text";
			result = ingestText(body.text, { source, existingNodeIds });
		} else {
			kind = "csv";
			const rows = body.csv ? parseEmployeeCsv(body.csv) : (body.rows ?? []);
			if (!Array.isArray(rows)) {
				return NextResponse.json(
					{ error: "rows must be an array" },
					{ status: 400 },
				);
			}
			result = mapEmployeeRows(rows, { source, existingNodeIds });
		}
	} catch (err) {
		return NextResponse.json({ error: (err as Error).message }, { status: 400 });
	}

	const items = await savePending(
		user.companyId,
		source,
		kind,
		result.proposals.map((p) => p.proposal),
	);

	return NextResponse.json({ summary: result.summary, items });
}
