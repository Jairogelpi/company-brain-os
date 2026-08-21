import type { GraphNode, GraphEdge, KnowledgeNode } from "./graph";
import {
	computeBusFactors,
	computeConfidences,
	computeResilience,
} from "./metrics";
import { explainRiskRule } from "./risk-rules";

function unique(values: string[]): string[] {
	return [...new Set(values)];
}

function edgeEvidence(edge: GraphEdge): string[] {
	const assertionId = edge.attributes?.assertionId;
	if (typeof assertionId === "string") return [`assertion:${assertionId}`];
	if (edge.id.startsWith("assertion:")) return [edge.id];
	return [`edge:${edge.id}`];
}

function nodeEvidence(node: GraphNode | undefined, predicates?: string[]): string[] {
	if (!node) return [];
	const provenance = node.attributes?.provenance;
	if (provenance && typeof provenance === "object" && !Array.isArray(provenance)) {
		const record = provenance as { assertionIds?: unknown; predicates?: unknown };
		if (predicates && record.predicates && typeof record.predicates === "object") {
			const predicateMap = record.predicates as Record<string, unknown>;
			const refs = predicates.flatMap((predicate) =>
				typeof predicateMap[predicate] === "string" ? [`assertion:${predicateMap[predicate]}`] : [],
			);
			if (refs.length > 0) return unique(refs);
		}
		if (Array.isArray(record.assertionIds)) {
			return record.assertionIds.flatMap((id) => typeof id === "string" ? [`assertion:${id}`] : []);
		}
	}
	return [`node:${node.id}`];
}

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
	ruleId: string;
	ruleVersion: number;
	inputFacts: Record<string, string | number | boolean | null>;
	evidenceRefs: string[];
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

function explanation(
	type: DetectedRisk["riskType"],
	inputFacts: DetectedRisk["inputFacts"],
	evidenceRefs: string[],
) {
	const rule = explainRiskRule(type);
	if (!rule) throw new Error(`Missing risk rule: ${type}`);
	return {
		trigger: rule.condition,
		ruleId: rule.id,
		ruleVersion: rule.version,
		inputFacts,
		evidenceRefs,
	};
}

/**
 * Single point of failure: bus factor 1 and critical. Documentation can reduce
 * recovery time, but it is not evidence that another person can perform the
 * work with the required access and competency.
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
				...explanation(
					"single_point_of_failure",
					{ busFactor: bf.busFactor, criticality: bf.criticality, documented: bf.documented },
					unique([
						...edges.filter((edge) => edge.type === "MASTERS" && edge.toNodeId === bf.knowledgeId).flatMap(edgeEvidence),
						...nodeEvidence(nodes.find((node) => node.id === bf.knowledgeId), ["CRITICALITY"]),
					]),
				),
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
				...explanation(
					"bus_factor_zero",
					{ busFactor: bf.busFactor, criticality: bf.criticality },
					nodeEvidence(nodes.find((node) => node.id === bf.knowledgeId), ["CRITICALITY"]),
				),
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
				...explanation(
					"undocumented_critical",
					{ documented: k.documented, criticality: k.criticality ?? null },
					nodeEvidence(k, ["DOCUMENTED", "CRITICALITY"]),
				),
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
				...explanation(
					"low_resilience",
					{ processResilience: r.resilienceScore, weakestKnowledgeId: r.weakestKnowledgeId ?? null },
					edges.filter((edge) => edge.type === "REQUIRES" && edge.fromNodeId === r.processId && edge.toNodeId === r.weakestKnowledgeId).flatMap(edgeEvidence),
				),
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
	const external = nodes.filter((n) => n.type === "ExternalParty");

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
		const label = ext.attributes?.subtype === "supplier" ? "Supplier" : "Client";
		risks.push({
			id: `risk-spoc-${ext.id}`,
			riskType: "single_point_of_contact",
			severity: ext.criticality === "high" ? "critical" : "high",
			sourceNodeId: ext.id,
			sourceNodeName: ext.name,
			relatedNodeIds: owners,
			message: `${label} "${ext.name}" relies on a single contact: ${ownerName}. No backup for this relationship.`,
			confidence: 0,
			...explanation(
				"single_point_of_contact",
				{ ownerCount: owners.length, criticality: ext.criticality ?? null },
				edges.filter((edge) => (edge.type === "OWNS" || edge.type === "MANAGES") && edge.toNodeId === ext.id && personIds.has(edge.fromNodeId)).flatMap(edgeEvidence),
			),
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
