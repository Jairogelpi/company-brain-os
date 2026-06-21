import type { GraphNode, GraphEdge, Criticality } from "./graph";
import { computeBusFactors } from "./metrics";

/**
 * Succession / offboarding playbook (change #2).
 *
 * Given a departing person, produce an ordered knowledge-transfer plan from the
 * knowledge they hold. Priority = criticality × exposure × urgency(bus factor);
 * exposure is optional and falls back to criticality → bus factor (spec).
 */

export interface PlaybookAction {
	knowledgeId: string;
	knowledgeName: string;
	criticality: Criticality | null;
	busFactor: number;
	documented: boolean | null;
	priorityScore: number;
	action: string;
	targetDate?: string; // ISO yyyy-mm-dd, set when a last day is given
	detailedSteps?: string[];
	suggestedTrainerId?: string;
	suggestedTrainerName?: string;
	rationale?: string;
	riskNote?: string;
}

export interface Playbook {
	personId: string;
	personName: string;
	lastDay?: string;
	actions: PlaybookAction[];
	summary: string;
}

export interface PlaybookOptions {
	lastDay?: string; // yyyy-mm-dd
	exposure?: Record<string, number>; // knowledgeId → € exposure (optional)
}

const CRIT_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };

export function generatePlaybook(
	personId: string,
	graph: { nodes: GraphNode[]; edges: GraphEdge[] },
	opts: PlaybookOptions = {},
): Playbook {
	const person = graph.nodes.find(
		(n) => n.id === personId && n.type === "Person",
	);
	const personName = person?.name ?? personId;

	const bfById = new Map(
		computeBusFactors(graph.nodes, graph.edges).map((b) => [b.knowledgeId, b]),
	);

	const masteredIds = graph.edges
		.filter((e) => e.type === "MASTERS" && e.fromNodeId === personId)
		.map((e) => e.toNodeId);

	const actions: PlaybookAction[] = masteredIds.map((kid) => {
		const bf = bfById.get(kid);
		const kNode = graph.nodes.find((n) => n.id === kid);
		const criticality = bf?.criticality ?? kNode?.criticality ?? null;
		const documented = bf?.documented ?? null;
		const busFactor = bf?.busFactor ?? 0;
		const name = bf?.knowledgeName ?? kNode?.name ?? kid;
		const weight = CRIT_WEIGHT[criticality ?? "low"] ?? 1;
		const exposure = opts.exposure?.[kid] ?? 0;
		// criticality dominates; exposure (€) breaks ties; fewer experts = sooner.
		const priorityScore = weight * 1e6 + exposure - busFactor;
		const action = documented
			? `Train a backup for "${name}"`
			: `Document "${name}" and train a backup`;
		return {
			knowledgeId: kid,
			knowledgeName: name,
			criticality,
			busFactor,
			documented,
			priorityScore,
			action,
		};
	});

	actions.sort((a, b) => b.priorityScore - a.priorityScore);

	if (opts.lastDay && actions.length > 0) {
		const today = Date.now();
		const last = new Date(`${opts.lastDay}T00:00:00Z`).getTime();
		const span = Math.max(last - today, 0);
		const n = actions.length;
		actions.forEach((a, i) => {
			// Highest priority (i=0) lands earliest; the last lands on lastDay.
			a.targetDate = new Date(today + (span * (i + 1)) / n)
				.toISOString()
				.slice(0, 10);
		});
	}

	const critical = actions.filter((a) => a.criticality === "high").length;
	return {
		personId,
		personName,
		lastDay: opts.lastDay,
		actions,
		summary: `${actions.length} transfer action(s) for ${personName}${
			critical ? ` · ${critical} critical` : ""
		}`,
	};
}
