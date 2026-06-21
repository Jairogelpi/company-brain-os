import type { GraphNode, GraphEdge, KnowledgeNode } from "./graph";
import { computeBusFactors, computeConfidences } from "./metrics";

// --- Genome types ---

export type GenomeCategory = "rule" | "value" | "policy";

export interface GenomeEntry {
	knowledgeId: string;
	name: string;
	category: GenomeCategory;
	busFactor: number;
	confidence: number;
	documented: boolean;
	expertNames: string[];
	description: string;
}

export interface GenomeReport {
	entries: GenomeEntry[];
	summary: {
		totalRules: number;
		totalValues: number;
		totalPolicies: number;
		documentedCount: number;
		undocumentedCount: number;
		atRisk: number; // bus factor ≤ 1 and undocumented
		genomeHealth: number; // % documented, 0-100
	};
}

const CATEGORY_ICONS: Record<GenomeCategory, string> = {
	rule: "📏",
	value: "💎",
	policy: "📋",
};

const CATEGORY_LABELS: Record<GenomeCategory, string> = {
	rule: "Unwritten Rule",
	value: "Company Value",
	policy: "Policy",
};

export function getCategoryIcon(cat: GenomeCategory): string {
	return CATEGORY_ICONS[cat];
}

export function getCategoryLabel(cat: GenomeCategory): string {
	return CATEGORY_LABELS[cat];
}

// --- Genome extraction ---

/**
 * Extract all Genome entries (rule, value, policy Knowledge nodes) from the graph.
 */
export function extractGenome(
	nodes: GraphNode[],
	edges: GraphEdge[],
): GenomeEntry[] {
	const busFactors = computeBusFactors(nodes, edges);
	const confidences = computeConfidences(nodes, edges);

	const genomeKnowledge = nodes.filter(
		(n) =>
			n.type === "Knowledge" &&
			["rule", "value", "policy"].includes(
				(n as KnowledgeNode).knowledgeType ?? "",
			),
	) as KnowledgeNode[];

	return genomeKnowledge.map((k) => {
		const bf = busFactors.find((b) => b.knowledgeId === k.id);
		const conf = confidences.find((c) => c.knowledgeId === k.id);
		const expertNames = (bf?.expertIds ?? []).map(
			(id) => nodes.find((n) => n.id === id)?.name ?? id,
		);

		return {
			knowledgeId: k.id,
			name: k.name,
			category: (k.knowledgeType as GenomeCategory) ?? "rule",
			busFactor: bf?.busFactor ?? 0,
			confidence: conf?.confidence ?? 0,
			documented: k.documented ?? false,
			expertNames,
			description: buildGenomeDescription(k, bf?.busFactor ?? 0, expertNames),
		};
	});
}

/**
 * Generate a full Genome report with summary statistics.
 */
export function generateGenomeReport(
	nodes: GraphNode[],
	edges: GraphEdge[],
): GenomeReport {
	const entries = extractGenome(nodes, edges);

	const rules = entries.filter((e) => e.category === "rule");
	const values = entries.filter((e) => e.category === "value");
	const policies = entries.filter((e) => e.category === "policy");

	const documentedCount = entries.filter((e) => e.documented).length;
	const undocumentedCount = entries.filter((e) => !e.documented).length;
	const atRisk = entries.filter(
		(e) => e.busFactor <= 1 && !e.documented,
	).length;

	return {
		entries,
		summary: {
			totalRules: rules.length,
			totalValues: values.length,
			totalPolicies: policies.length,
			documentedCount,
			undocumentedCount,
			atRisk,
			genomeHealth:
				entries.length > 0
					? Math.round((documentedCount / entries.length) * 100)
					: 100,
		},
	};
}

function buildGenomeDescription(
	k: KnowledgeNode,
	busFactor: number,
	experts: string[],
): string {
	const category = k.knowledgeType as GenomeCategory;
	const label = CATEGORY_LABELS[category] ?? "Knowledge";

	let desc = `${label}: "${k.name}"`;

	if (busFactor === 0) {
		desc += " — ⚠️ Lost: no one currently masters this.";
	} else if (busFactor === 1 && experts.length > 0) {
		desc += ` — Only ${experts[0]} knows this. Risk of loss.`;
	} else if (experts.length > 0) {
		desc += ` — Known by ${experts.join(", ")}.`;
	}

	if (!k.documented) {
		desc += " Not documented.";
	} else {
		desc += " Documented.";
	}

	return desc;
}

// --- Genome health scoring ---

/**
 * Compute a detailed genome health score with breakdown.
 */
export function computeGenomeHealth(
	nodes: GraphNode[],
	edges: GraphEdge[],
): {
	score: number; // 0-100
	breakdown: string[];
} {
	const report = generateGenomeReport(nodes, edges);
	const breakdown: string[] = [];

	if (
		report.summary.totalRules +
			report.summary.totalValues +
			report.summary.totalPolicies ===
		0
	) {
		return {
			score: 100,
			breakdown: [
				"No genome entries found. The company's unwritten rules haven't been captured yet.",
			],
		};
	}

	// Documentation coverage (40%)
	const docScore = report.summary.genomeHealth;
	breakdown.push(`Documentation: ${docScore}% of genome documented`);

	// Bus factor coverage (35%)
	const covered = report.entries.filter((e) => e.busFactor >= 2).length;
	const bfs =
		report.entries.length > 0
			? Math.round((covered / report.entries.length) * 100)
			: 100;
	breakdown.push(
		`Bus factor ≥ 2: ${bfs}% (${covered}/${report.entries.length})`,
	);

	// At-risk penalty (25%)
	const atRisk = report.summary.atRisk;
	const riskPenalty = Math.min(25, atRisk * 5);
	breakdown.push(`At-risk entries: ${atRisk} (penalty: -${riskPenalty})`);

	const score = Math.max(
		0,
		Math.round(docScore * 0.4 + bfs * 0.35 - riskPenalty + 10),
	);

	return { score, breakdown };
}
