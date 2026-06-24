import type { GraphNode, GraphEdge, KnowledgeNode } from "./graph";
import {
	computeBusFactors,
	computeConfidences,
	computeResilience,
} from "./metrics";

// --- Risk types ---

export interface DetectedRisk {
	id: string;
	riskType:
		| "single_point_of_failure"
		| "low_resilience"
		| "undocumented_critical"
		| "bus_factor_zero"
		| "single_point_of_contact";
	severity: "critical" | "high" | "medium";
	sourceNodeId: string;
	sourceNodeName: string;
	relatedNodeIds: string[];
	message: string;
	confidence: number; // knowledge confidence (0–100), lower = riskier
	trigger: string; // what triggered this risk
}

export interface RiskReport {
	risks: DetectedRisk[];
	summary: {
		total: number;
		critical: number;
		high: number;
		medium: number;
		averageConfidence: number;
	};
}

// --- Risk detectors ---

/**
 * Single point of failure: bus factor 1, critical, and undocumented.
 * Documented knowledge is recoverable even with one expert.
 */
export function detectSinglePointOfFailure(
	nodes: GraphNode[],
	edges: GraphEdge[],
): DetectedRisk[] {
	const busFactors = computeBusFactors(nodes, edges);
	const confidences = computeConfidences(nodes, edges);

	return busFactors
		.filter((bf) => {
			// Bus factor 1 means exactly one expert at level ≥ 3
			if (bf.busFactor !== 1) return false;
			// Must be critical
			if (bf.criticality !== "high") return false;
			// Documented + validated knowledge is recoverable — skip
			if (bf.documented === true) return false;
			return true;
		})
		.map((bf) => {
			const conf = confidences.find((c) => c.knowledgeId === bf.knowledgeId);
			const knowledgeName = bf.knowledgeName;
			const expertName =
				nodes.find((n) => n.id === bf.expertIds[0])?.name ?? "unknown";

			return {
				id: `risk-spof-${bf.knowledgeId}`,
				riskType: "single_point_of_failure" as const,
				severity:
					(conf?.confidence ?? 0) < 30
						? ("critical" as const)
						: ("high" as const),
				sourceNodeId: bf.knowledgeId,
				sourceNodeName: knowledgeName,
				relatedNodeIds: bf.expertIds,
				message: `"${knowledgeName}" depends entirely on ${expertName}. Bus factor = 1. Confidence = ${conf?.confidence ?? "?"}%.`,
				confidence: conf?.confidence ?? 0,
				trigger: `bus_factor=1 AND criticality=high AND confidence<50`,
			};
		});
}

/**
 * Bus factor zero: Knowledge that no one masters at level ≥ 3 (lost knowledge).
 */
export function detectBusFactorZero(
	nodes: GraphNode[],
	edges: GraphEdge[],
): DetectedRisk[] {
	const busFactors = computeBusFactors(nodes, edges);

	return busFactors
		.filter((bf) => bf.busFactor === 0 && bf.criticality === "high")
		.map((bf) => {
			return {
				id: `risk-bf0-${bf.knowledgeId}`,
				riskType: "bus_factor_zero" as const,
				severity: "critical" as const,
				sourceNodeId: bf.knowledgeId,
				sourceNodeName: bf.knowledgeName,
				relatedNodeIds: [],
				message: `"${bf.knowledgeName}" has ZERO experts at level ≥ 3. Knowledge may be lost.`,
				confidence: 0,
				trigger: `bus_factor=0 AND criticality=high`,
			};
		});
}

/**
 * Undocumented critical: Knowledge that is critical but not documented.
 */
export function detectUndocumentedCritical(
	nodes: GraphNode[],
	_edges: GraphEdge[],
): DetectedRisk[] {
	const knowledgeNodes = nodes.filter(
		(n) => n.type === "Knowledge",
	) as KnowledgeNode[];

	return knowledgeNodes
		.filter((k) => k.criticality === "high" && k.documented === false)
		.map((k) => {
			return {
				id: `risk-undoc-${k.id}`,
				riskType: "undocumented_critical" as const,
				severity: "high" as const,
				sourceNodeId: k.id,
				sourceNodeName: k.name,
				relatedNodeIds: [],
				message: `"${k.name}" is critical but NOT documented. If the expert leaves, there is no written reference.`,
				confidence: k.confidence ?? 25,
				trigger: `documented=false AND criticality=high`,
			};
		});
}

/**
 * Low resilience: Processes whose weakest required Knowledge has low bus factor.
 */
export function detectLowResilience(
	nodes: GraphNode[],
	edges: GraphEdge[],
): DetectedRisk[] {
	const resilience = computeResilience(nodes, edges);

	return resilience
		.filter((r) => r.resilienceScore <= 1 && r.weakestKnowledgeId)
		.map((r) => {
			return {
				id: `risk-lowres-${r.processId}`,
				riskType: "low_resilience" as const,
				severity:
					r.resilienceScore === 0 ? ("critical" as const) : ("high" as const),
				sourceNodeId: r.processId,
				sourceNodeName: r.processName,
				relatedNodeIds: r.weakestKnowledgeId ? [r.weakestKnowledgeId] : [],
				message: `Process "${r.processName}" relies on "${r.weakestKnowledgeName}" which has bus factor ${r.resilienceScore}.`,
				confidence:
					computeConfidences(nodes, edges).find(
						(c) => c.knowledgeId === r.weakestKnowledgeId,
					)?.confidence ?? 0,
				trigger: `process_resilience<=1`,
			};
		});
}

/**
 * Single point of contact: a Client or Supplier whose relationship is owned by
 * exactly one person (OWNS/MANAGES). If that person leaves, the relationship is
 * orphaned — the external-facing equivalent of bus factor 1.
 */
export function detectSinglePointOfContact(
	nodes: GraphNode[],
	edges: GraphEdge[],
): DetectedRisk[] {
	const personIds = new Set(
		nodes.filter((n) => n.type === "Person").map((n) => n.id),
	);
	const external = nodes.filter(
		(n) => n.type === "Client" || n.type === "Supplier",
	);

	const risks: DetectedRisk[] = [];
	for (const ext of external) {
		const owners = [
			...new Set(
				edges
					.filter(
						(e) =>
							(e.type === "OWNS" || e.type === "MANAGES") &&
							e.toNodeId === ext.id &&
							personIds.has(e.fromNodeId),
					)
					.map((e) => e.fromNodeId),
			),
		];
		if (owners.length !== 1) continue;
		const ownerName = nodes.find((n) => n.id === owners[0])?.name ?? "unknown";
		const label = ext.type === "Client" ? "Client" : "Supplier";
		risks.push({
			id: `risk-spoc-${ext.id}`,
			riskType: "single_point_of_contact",
			severity: ext.criticality === "high" ? "critical" : "high",
			sourceNodeId: ext.id,
			sourceNodeName: ext.name,
			relatedNodeIds: owners,
			message: `${label} "${ext.name}" relies on a single contact: ${ownerName}. No backup for this relationship.`,
			confidence: 0,
			trigger: `single owner of ${label.toLowerCase()}`,
		});
	}
	return risks;
}

/**
 * Run all risk detectors and produce a unified report.
 */
export function detectAllRisks(
	nodes: GraphNode[],
	edges: GraphEdge[],
): RiskReport {
	const spof = detectSinglePointOfFailure(nodes, edges);
	const bf0 = detectBusFactorZero(nodes, edges);
	const undoc = detectUndocumentedCritical(nodes, edges);
	const lowRes = detectLowResilience(nodes, edges);
	const spoc = detectSinglePointOfContact(nodes, edges);

	const allRisks = [...spof, ...bf0, ...undoc, ...lowRes, ...spoc];

	const critical = allRisks.filter((r) => r.severity === "critical").length;
	const high = allRisks.filter((r) => r.severity === "high").length;
	const medium = allRisks.filter((r) => r.severity === "medium").length;
	const avgConf =
		allRisks.length > 0
			? Math.round(
					allRisks.reduce((sum, r) => sum + r.confidence, 0) / allRisks.length,
				)
			: 100;

	return {
		risks: allRisks,
		summary: {
			total: allRisks.length,
			critical,
			high,
			medium,
			averageConfidence: avgConf,
		},
	};
}
