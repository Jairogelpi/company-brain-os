import type { GraphNode, GraphEdge, KnowledgeNode } from "./graph";

// --- Metric types ---

export interface KnowledgeBusFactor {
	knowledgeId: string;
	knowledgeName: string;
	busFactor: number;
	expertIds: string[];
	criticality: "low" | "medium" | "high" | null;
	documented: boolean | null;
}

export interface KnowledgeConfidence {
	knowledgeId: string;
	knowledgeName: string;
	confidence: number; // 0–100
	busFactorWeight: number;
	validationWeight: number;
	documentationWeight: number;
}

export interface KnowledgeCoverage {
	totalCritical: number;
	coveredCritical: number; // bus factor ≥ 2
	coveragePercent: number; // 0–100
}

export interface PersonDependency {
	personId: string;
	personName: string;
	dependencyScore: number;
	criticalNodes: string[]; // Knowledge/Process IDs where they're the sole expert (level ≥ 3)
}

export interface ProcessResilience {
	processId: string;
	processName: string;
	resilienceScore: number; // minimum bus factor among required Knowledge
	weakestKnowledgeId: string | null;
	weakestKnowledgeName: string | null;
}

export interface TransferVelocity {
	edgeId: string;
	personId: string;
	knowledgeId: string;
	oldLevel: number;
	newLevel: number;
	velocity: number; // Δlevel / months
}

export interface OrganizationalHealth {
	overallScore: number; // 0–100
	coverageScore: number;
	resilienceScore: number;
	riskPenalty: number;
	openRiskCount: number;
}

export interface CompanyIQ {
	iq: number; // 0–100
	totalKnowledge: number;
	documentedAndValidated: number;
}

export interface GraphMetrics {
	busFactors: KnowledgeBusFactor[];
	confidences: KnowledgeConfidence[];
	coverage: KnowledgeCoverage;
	dependencies: PersonDependency[];
	resilience: ProcessResilience[];
	health: OrganizationalHealth;
	companyIQ: CompanyIQ;
}

// --- Metric computation ---

/**
 * Bus factor: number of Person nodes with MASTERS level ≥ 3 for each Knowledge node.
 */
export function computeBusFactors(
	nodes: GraphNode[],
	edges: GraphEdge[],
): KnowledgeBusFactor[] {
	const knowledgeNodes = nodes.filter(
		(n) => n.type === "Knowledge",
	) as KnowledgeNode[];
	const personNodes = nodes.filter((n) => n.type === "Person");
	const masteryEdges = edges.filter((e) => e.type === "MASTERS");

	return knowledgeNodes.map((k) => {
		const experts = masteryEdges
			.filter(
				(e) =>
					e.toNodeId === k.id &&
					(e.attributes?.level as number) >= 3 &&
					personNodes.some((p) => p.id === e.fromNodeId),
			)
			.map((e) => e.fromNodeId);

		return {
			knowledgeId: k.id,
			knowledgeName: k.name,
			busFactor: experts.length,
			expertIds: experts,
			criticality: k.criticality ?? null,
			documented: k.documented ?? null,
		};
	});
}

/**
 * Knowledge confidence (0–100): weighted composite of bus factor, validation state, and documentation.
 */
export function computeConfidences(
	nodes: GraphNode[],
	edges: GraphEdge[],
): KnowledgeConfidence[] {
	const busFactors = computeBusFactors(nodes, edges);
	const knowledgeNodes = nodes.filter(
		(n) => n.type === "Knowledge",
	) as KnowledgeNode[];

	return knowledgeNodes.map((k) => {
		const bf = busFactors.find((b) => b.knowledgeId === k.id);
		const busFactorWeight = Math.min(100, (bf?.busFactor ?? 0) * 25); // 0 experts=0, 4+=100
		const validationWeight =
			k.validationState === "validated"
				? 100
				: k.validationState === "proposed"
					? 40
					: 10; // draft or missing
		const documentationWeight = k.documented ? 80 : 20;

		const confidence = Math.round(
			busFactorWeight * 0.4 +
				validationWeight * 0.35 +
				documentationWeight * 0.25,
		);

		return {
			knowledgeId: k.id,
			knowledgeName: k.name,
			confidence: Math.max(0, Math.min(100, confidence)),
			busFactorWeight,
			validationWeight,
			documentationWeight,
		};
	});
}

/**
 * Knowledge coverage: % of critical Knowledge with bus factor ≥ 2.
 */
export function computeCoverage(
	nodes: GraphNode[],
	edges: GraphEdge[],
): KnowledgeCoverage {
	const busFactors = computeBusFactors(nodes, edges);
	const critical = busFactors.filter((bf) => bf.criticality === "high");
	const covered = critical.filter((bf) => bf.busFactor >= 2);

	return {
		totalCritical: critical.length,
		coveredCritical: covered.length,
		coveragePercent:
			critical.length > 0
				? Math.round((covered.length / critical.length) * 100)
				: 100,
	};
}

/**
 * Dependency score: for each Person, count of critical Knowledge/Process where
 * they are the SOLE expert (MASTERS level ≥ 3, no other Person has level ≥ 3).
 */
export function computeDependencies(
	nodes: GraphNode[],
	edges: GraphEdge[],
): PersonDependency[] {
	const busFactors = computeBusFactors(nodes, edges);
	const personNodes = nodes.filter((n) => n.type === "Person");
	const processNodes = nodes.filter((n) => n.type === "Process");

	// For each Person, find Knowledge nodes where they're the only expert
	return personNodes.map((person) => {
		const criticalNodes: string[] = [];

		// Check Knowledge nodes where this person is the sole expert
		for (const bf of busFactors) {
			if (
				bf.busFactor === 1 &&
				bf.expertIds.includes(person.id) &&
				bf.criticality === "high"
			) {
				criticalNodes.push(bf.knowledgeId);
			}
		}

		return {
			personId: person.id,
			personName: person.name,
			dependencyScore: criticalNodes.length,
			criticalNodes,
		};
	});
}

/**
 * Process resilience: minimum bus factor among all Knowledge that the process REQUIRES.
 */
export function computeResilience(
	nodes: GraphNode[],
	edges: GraphEdge[],
): ProcessResilience[] {
	const busFactors = computeBusFactors(nodes, edges);
	const processNodes = nodes.filter((n) => n.type === "Process");
	const requiresEdges = edges.filter((e) => e.type === "REQUIRES");

	return processNodes.map((process) => {
		const requiredKnowledge = requiresEdges
			.filter((e) => e.fromNodeId === process.id)
			.map((e) => e.toNodeId);

		let minBusFactor = Infinity;
		let weakestId: string | null = null;
		let weakestName: string | null = null;

		for (const kid of requiredKnowledge) {
			const bf = busFactors.find((b) => b.knowledgeId === kid);
			const factor = bf?.busFactor ?? 0;
			if (factor < minBusFactor) {
				minBusFactor = factor;
				weakestId = kid;
				weakestName = bf?.knowledgeName ?? null;
			}
		}

		return {
			processId: process.id,
			processName: process.name,
			resilienceScore:
				requiredKnowledge.length === 0
					? 100
					: minBusFactor === Infinity
						? 0
						: minBusFactor,
			weakestKnowledgeId: weakestId,
			weakestKnowledgeName: weakestName,
		};
	});
}

/**
 * Organizational health (0–100): composite of coverage, resilience, and open risks.
 */
export function computeHealth(
	nodes: GraphNode[],
	edges: GraphEdge[],
	openRiskCount?: number,
): OrganizationalHealth {
	const coverage = computeCoverage(nodes, edges);
	const resilienceData = computeResilience(nodes, edges);

	const avgResilience =
		resilienceData.length > 0
			? resilienceData.reduce((sum, r) => sum + r.resilienceScore, 0) /
				resilienceData.length
			: 100;

	// Normalize resilience to 0-100 scale
	const resilienceScore = Math.round(Math.min(100, avgResilience * 20)); // each expert = 20 points

	const riskCount = openRiskCount ?? 0;
	const riskPenalty = Math.min(40, riskCount * 10); // each risk penalizes up to 10, max 40

	const coverageScore = coverage.coveragePercent;
	const overallScore = Math.max(
		0,
		Math.round(coverageScore * 0.4 + resilienceScore * 0.35 - riskPenalty + 15), // +15 base health
	);

	return {
		overallScore: Math.min(100, overallScore),
		coverageScore,
		resilienceScore,
		riskPenalty,
		openRiskCount: riskCount,
	};
}

/**
 * Company IQ: % of Knowledge nodes that are both documented AND validated.
 */
export function computeCompanyIQ(nodes: GraphNode[]): CompanyIQ {
	const knowledgeNodes = nodes.filter(
		(n) => n.type === "Knowledge",
	) as KnowledgeNode[];
	const totalKnowledge = knowledgeNodes.length;
	const documentedAndValidated = knowledgeNodes.filter(
		(k) => k.documented === true && k.validationState === "validated",
	).length;

	return {
		iq:
			totalKnowledge > 0
				? Math.round((documentedAndValidated / totalKnowledge) * 100)
				: 0,
		totalKnowledge,
		documentedAndValidated,
	};
}

/**
 * Compute all metrics in one pass.
 */
export function computeAllMetrics(
	nodes: GraphNode[],
	edges: GraphEdge[],
	openRiskCount?: number,
): GraphMetrics {
	return {
		busFactors: computeBusFactors(nodes, edges),
		confidences: computeConfidences(nodes, edges),
		coverage: computeCoverage(nodes, edges),
		dependencies: computeDependencies(nodes, edges),
		resilience: computeResilience(nodes, edges),
		health: computeHealth(nodes, edges, openRiskCount),
		companyIQ: computeCompanyIQ(nodes),
	};
}
