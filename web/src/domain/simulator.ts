import type { GraphNode, GraphEdge, KnowledgeNode } from "./graph";
import {
	computeBusFactors,
	computeConfidences,
	computeDependencies,
	computeResilience,
	computeAllMetrics,
	type GraphMetrics,
} from "./metrics";
import { detectAllRisks, type RiskReport } from "./risk-engine";

// --- Simulator types ---

export interface SimulationImpact {
	knowledgeId: string;
	knowledgeName: string;
	impact: "lost" | "degraded" | "unchanged";
	busFactorBefore: number;
	busFactorAfter: number;
	confidenceBefore: number;
	confidenceAfter: number;
}

export interface ProcessSimImpact {
	processId: string;
	processName: string;
	resilienceBefore: number;
	resilienceAfter: number;
	impact: "broken" | "weakened" | "unchanged";
}

export interface DependencyShift {
	personId: string;
	personName: string;
	dependencyScoreBefore: number;
	dependencyScoreAfter: number;
	newCriticalNodes: string[];
}

export interface SimulationReport {
	personId: string;
	personName: string;
	scenario: string;
	knowledgeImpacts: SimulationImpact[];
	processImpacts: ProcessSimImpact[];
	dependencyShifts: DependencyShift[];
	metricsBefore: GraphMetrics;
	metricsAfter: GraphMetrics;
	risksBefore: RiskReport;
	risksAfter: RiskReport;
	summary: {
		lostKnowledge: number;
		degradedKnowledge: number;
		brokenProcesses: number;
		newRisks: number;
		healthDrop: number;
		message: string;
	};
}

// --- Core simulation ---

function filterEdgesForDepartingPeople(
	edges: GraphEdge[],
	personIds: string[],
): GraphEdge[] {
	return edges.filter(
		(e) => !personIds.includes(e.fromNodeId) && !personIds.includes(e.toNodeId),
	);
}

/**
 * Simulate the impact of a person leaving the company.
 * Removes all edges from the target person, recalculates everything, and compares.
 */
export function simulatePersonLeaving(
	nodes: GraphNode[],
	edges: GraphEdge[],
	personId: string,
): SimulationReport {
	const person = nodes.find((n) => n.id === personId && n.type === "Person");
	const personName = person?.name ?? personId;

	// Compute BEFORE state
	const metricsBefore = computeAllMetrics(nodes, edges);
	const risksBefore = detectAllRisks(nodes, edges);

	if (!person) {
		return {
			personId,
			personName,
			scenario: `What if ${personName} leaves?`,
			knowledgeImpacts: [],
			processImpacts: [],
			dependencyShifts: [],
			metricsBefore,
			metricsAfter: metricsBefore,
			risksBefore,
			risksAfter: risksBefore,
			summary: {
				lostKnowledge: 0,
				degradedKnowledge: 0,
				brokenProcesses: 0,
				newRisks: 0,
				healthDrop: 0,
				message: `⚠️ Person not found: ${personId}`,
			},
		};
	}

	// Clone and remove person's edges
	const remainingEdges = filterEdgesForDepartingPeople(edges, [personId]);

	// Compute AFTER state
	const metricsAfter = computeAllMetrics(nodes, remainingEdges);
	const risksAfter = detectAllRisks(nodes, remainingEdges);

	// --- Knowledge impacts ---
	const busFactorsBefore = computeBusFactors(nodes, edges);
	const busFactorsAfter = computeBusFactors(nodes, remainingEdges);
	const confidencesBefore = computeConfidences(nodes, edges);
	const confidencesAfter = computeConfidences(nodes, remainingEdges);

	const knowledgeNodes = nodes.filter(
		(n) => n.type === "Knowledge",
	) as KnowledgeNode[];
	const knowledgeImpacts: SimulationImpact[] = knowledgeNodes.map((k) => {
		const bfBefore = busFactorsBefore.find((b) => b.knowledgeId === k.id);
		const bfAfter = busFactorsAfter.find((b) => b.knowledgeId === k.id);
		const confBefore = confidencesBefore.find((c) => c.knowledgeId === k.id);
		const confAfter = confidencesAfter.find((c) => c.knowledgeId === k.id);

		const busFactorBefore = bfBefore?.busFactor ?? 0;
		const busFactorAfter = bfAfter?.busFactor ?? 0;

		let impact: SimulationImpact["impact"];
		if (busFactorAfter === 0 && busFactorBefore > 0) {
			impact = "lost";
		} else if (busFactorAfter < busFactorBefore) {
			impact = "degraded";
		} else {
			impact = "unchanged";
		}

		return {
			knowledgeId: k.id,
			knowledgeName: k.name,
			impact,
			busFactorBefore,
			busFactorAfter,
			confidenceBefore: confBefore?.confidence ?? 0,
			confidenceAfter: confAfter?.confidence ?? 0,
		};
	});

	// --- Process impacts ---
	const resilienceBefore = computeResilience(nodes, edges);
	const resilienceAfter = computeResilience(nodes, remainingEdges);
	const processNodes = nodes.filter((n) => n.type === "Process");
	const processImpacts: ProcessSimImpact[] = processNodes.map((p) => {
		const resBefore = resilienceBefore.find((r) => r.processId === p.id);
		const resAfter = resilienceAfter.find((r) => r.processId === p.id);

		const resilienceBeforeVal = resBefore?.resilienceScore ?? 100;
		const resilienceAfterVal = resAfter?.resilienceScore ?? 100;

		let impact: ProcessSimImpact["impact"];
		if (resilienceAfterVal === 0 && resilienceBeforeVal > 0) {
			impact = "broken";
		} else if (resilienceAfterVal < resilienceBeforeVal) {
			impact = "weakened";
		} else {
			impact = "unchanged";
		}

		return {
			processId: p.id,
			processName: p.name,
			resilienceBefore: resilienceBeforeVal,
			resilienceAfter: resilienceAfterVal,
			impact,
		};
	});

	// --- Dependency shifts ---
	const depsBefore = computeDependencies(nodes, edges);
	const depsAfter = computeDependencies(nodes, remainingEdges);
	const otherPeople = nodes.filter(
		(n) => n.type === "Person" && n.id !== personId,
	);

	const dependencyShifts: DependencyShift[] = otherPeople.map((p) => {
		const before = depsBefore.find((d) => d.personId === p.id);
		const after = depsAfter.find((d) => d.personId === p.id);

		const beforeScore = before?.dependencyScore ?? 0;
		const afterScore = after?.dependencyScore ?? 0;

		// New critical nodes that this person is now sole expert of
		const newCritical = (after?.criticalNodes ?? []).filter(
			(id) => !(before?.criticalNodes ?? []).includes(id),
		);

		return {
			personId: p.id,
			personName: p.name,
			dependencyScoreBefore: beforeScore,
			dependencyScoreAfter: afterScore,
			newCriticalNodes: newCritical,
		};
	});

	// --- Summary ---
	const lostKnowledge = knowledgeImpacts.filter(
		(k) => k.impact === "lost",
	).length;
	const degradedKnowledge = knowledgeImpacts.filter(
		(k) => k.impact === "degraded",
	).length;
	const brokenProcesses = processImpacts.filter(
		(p) => p.impact === "broken",
	).length;
	const newRisks = risksAfter.summary.total - risksBefore.summary.total;
	const healthDrop =
		metricsBefore.health.overallScore - metricsAfter.health.overallScore;

	const lostNames = knowledgeImpacts
		.filter((k) => k.impact === "lost")
		.map((k) => `"${k.knowledgeName}"`)
		.join(", ");

	let message: string;
	if (lostKnowledge > 0) {
		message = `🚨 If ${personName} leaves, ${lostKnowledge} knowledge area(s) would be LOST: ${lostNames}. `;
		if (brokenProcesses > 0)
			message += `${brokenProcesses} process(es) would break. `;
		message += `Health drops ${healthDrop} points. ${newRisks > 0 ? `${newRisks} new risks emerge.` : ""}`;
	} else if (degradedKnowledge > 0) {
		message = `⚠️ ${personName}'s departure degrades ${degradedKnowledge} knowledge area(s). Health drops ${healthDrop} points.`;
	} else {
		message = `✅ ${personName}'s departure has no significant impact — knowledge is well distributed.`;
	}

	return {
		personId,
		personName,
		scenario: `What if ${personName} leaves?`,
		knowledgeImpacts,
		processImpacts,
		dependencyShifts,
		metricsBefore,
		metricsAfter,
		risksBefore,
		risksAfter,
		summary: {
			lostKnowledge,
			degradedKnowledge,
			brokenProcesses,
			newRisks,
			healthDrop,
			message,
		},
	};
}

/**
 * Simulate multiple people leaving simultaneously (worst-case scenario).
 */
export function simulateMultipleLeaving(
	nodes: GraphNode[],
	edges: GraphEdge[],
	personIds: string[],
): SimulationReport {
	// Remove all edges from all target people
	const remainingEdges = filterEdgesForDepartingPeople(edges, personIds);

	// Compute BEFORE state with original edges
	const metricsBefore = computeAllMetrics(nodes, edges);
	const risksBefore = detectAllRisks(nodes, edges);

	// Compute AFTER state with edges removed
	const metricsAfter = computeAllMetrics(nodes, remainingEdges);
	const risksAfter = detectAllRisks(nodes, remainingEdges);

	const names = personIds
		.map((id) => nodes.find((n) => n.id === id)?.name ?? id)
		.join(", ");

	// Build report manually (not via simulatePersonLeaving to avoid double-filtering)
	const busFactorsBefore = computeBusFactors(nodes, edges);
	const busFactorsAfter = computeBusFactors(nodes, remainingEdges);
	const confidencesBefore = computeConfidences(nodes, edges);
	const confidencesAfter = computeConfidences(nodes, remainingEdges);

	const knowledgeNodes = nodes.filter((n) => n.type === "Knowledge");
	const knowledgeImpacts: SimulationImpact[] = knowledgeNodes.map((k) => {
		const bfBefore = busFactorsBefore.find((b) => b.knowledgeId === k.id);
		const bfAfter = busFactorsAfter.find((b) => b.knowledgeId === k.id);
		const confBefore = confidencesBefore.find((c) => c.knowledgeId === k.id);
		const confAfter = confidencesAfter.find((c) => c.knowledgeId === k.id);

		const busFactorBefore = bfBefore?.busFactor ?? 0;
		const busFactorAfter = bfAfter?.busFactor ?? 0;

		let impact: SimulationImpact["impact"];
		if (busFactorAfter === 0 && busFactorBefore > 0) impact = "lost";
		else if (busFactorAfter < busFactorBefore) impact = "degraded";
		else impact = "unchanged";

		return {
			knowledgeId: k.id,
			knowledgeName: k.name,
			impact,
			busFactorBefore,
			busFactorAfter,
			confidenceBefore: confBefore?.confidence ?? 0,
			confidenceAfter: confAfter?.confidence ?? 0,
		};
	});

	const resilienceBefore = computeResilience(nodes, edges);
	const resilienceAfter = computeResilience(nodes, remainingEdges);
	const processNodes = nodes.filter((n) => n.type === "Process");
	const processImpacts: ProcessSimImpact[] = processNodes.map((p) => {
		const resBefore = resilienceBefore.find((r) => r.processId === p.id);
		const resAfter = resilienceAfter.find((r) => r.processId === p.id);
		const beforeVal = resBefore?.resilienceScore ?? 100;
		const afterVal = resAfter?.resilienceScore ?? 100;
		let impact: ProcessSimImpact["impact"];
		if (afterVal === 0 && beforeVal > 0) impact = "broken";
		else if (afterVal < beforeVal) impact = "weakened";
		else impact = "unchanged";
		return {
			processId: p.id,
			processName: p.name,
			resilienceBefore: beforeVal,
			resilienceAfter: afterVal,
			impact,
		};
	});

	const depsBefore = computeDependencies(nodes, edges);
	const depsAfter = computeDependencies(nodes, remainingEdges);
	const remainingPeople = nodes.filter(
		(n) => n.type === "Person" && !personIds.includes(n.id),
	);
	const dependencyShifts: DependencyShift[] = remainingPeople.map((p) => {
		const before = depsBefore.find((d) => d.personId === p.id);
		const after = depsAfter.find((d) => d.personId === p.id);
		const newCritical = (after?.criticalNodes ?? []).filter(
			(id) => !(before?.criticalNodes ?? []).includes(id),
		);
		return {
			personId: p.id,
			personName: p.name,
			dependencyScoreBefore: before?.dependencyScore ?? 0,
			dependencyScoreAfter: after?.dependencyScore ?? 0,
			newCriticalNodes: newCritical,
		};
	});

	const lostKnowledge = knowledgeImpacts.filter(
		(k) => k.impact === "lost",
	).length;
	const degradedKnowledge = knowledgeImpacts.filter(
		(k) => k.impact === "degraded",
	).length;
	const brokenProcesses = processImpacts.filter(
		(p) => p.impact === "broken",
	).length;
	const newRisks = risksAfter.summary.total - risksBefore.summary.total;
	const healthDrop =
		metricsBefore.health.overallScore - metricsAfter.health.overallScore;

	let message: string;
	if (lostKnowledge > 0) {
		message = `🚨 If ${names} leave, ${lostKnowledge} knowledge area(s) would be LOST. `;
		if (brokenProcesses > 0)
			message += `${brokenProcesses} process(es) would break. `;
		message += `Health drops ${healthDrop} points.`;
	} else {
		message = `⚠️ ${names}'s departure degrades ${degradedKnowledge} area(s). Health drops ${healthDrop} points.`;
	}

	return {
		personId: personIds[0],
		personName: names,
		scenario: `What if ${names} all leave?`,
		knowledgeImpacts,
		processImpacts,
		dependencyShifts,
		metricsBefore,
		metricsAfter,
		risksBefore,
		risksAfter,
		summary: {
			lostKnowledge,
			degradedKnowledge,
			brokenProcesses,
			newRisks,
			healthDrop,
			message,
		},
	};
}
