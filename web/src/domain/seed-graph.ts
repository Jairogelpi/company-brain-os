import { createInterviewSession, answerInterviewQuestion } from "./interview";
import type { PersistentGraphService } from "./persistent-graph-service";

/**
 * Canonical demo interview answers used to seed a fresh company graph.
 * Extracted so both the API seed endpoint and tests share one source.
 */
export const DEMO_INTERVIEW_ANSWERS = [
	"Pedro es indispensable; si falta mañana se para producción.",
	"Solo Pedro configura la llenadora crítica y nadie más sabe hacerlo.",
	"Laura lo vio una vez, nivel 2; no hay sustituto real.",
	"No está escrito en ningún sitio.",
	"Siempre pedimos tres cotizaciones antes de comprar",
];

export function buildDemoSession() {
	return DEMO_INTERVIEW_ANSWERS.reduce(
		(session, answer) => answerInterviewQuestion(session, answer),
		createInterviewSession(),
	);
}

/**
 * Seeds the demo graph into a persistent (DB-backed) service.
 * Idempotent: does nothing if the company already has nodes.
 */
export async function seedDemoGraph(
	service: PersistentGraphService,
): Promise<{ seeded: boolean; nodeCount: number }> {
	const existing = await service.listNodes();
	if (existing.length > 0) {
		return { seeded: false, nodeCount: existing.length };
	}

	const session = buildDemoSession();
	const decisions = session.proposals.map((_, i) => ({
		proposalIndex: i,
		decision: "approve" as const,
	}));
	await service.applyProposalsWithDecisions(session.proposals, decisions);

	// A sample unwritten rule so the Genome view has cultural-DNA content.
	try {
		await service.createNode({
			id: "rule-sample",
			type: "Knowledge",
			name: "no dar muestra sin pago",
			knowledgeType: "rule",
			documented: false,
			validationState: "proposed",
			confidence: 30,
			criticality: "medium",
		});
		await service.createEdge({
			id: "edge-rule-pedro",
			type: "MASTERS",
			fromNodeId: "person-pedro",
			toNodeId: "rule-sample",
			attributes: { level: 4 },
		});
	} catch {
		// node/edge may already exist, or pedro id differs — non-fatal
	}

	const nodes = await service.listNodes();
	return { seeded: true, nodeCount: nodes.length };
}
