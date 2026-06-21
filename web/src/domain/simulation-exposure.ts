import type { GraphNode } from "./graph";
import type { SimulationReport } from "./simulator";
import { computeTotalExposure } from "./financial-exposure";

/**
 * Euro impact of a simulated departure: the exposure of risks that did NOT
 * exist before the person left (de-duplicated by at-risk node). Reuses the #4
 * cost model, so it degrades gracefully (estimated) when costs are unset.
 */
export function simulationExposure(
	report: SimulationReport,
	nodes: GraphNode[],
): { total: number; currency: string; newRiskCount: number } {
	const beforeIds = new Set(report.risksBefore.risks.map((r) => r.id));
	const newRisks = report.risksAfter.risks.filter((r) => !beforeIds.has(r.id));
	const { total, currency } = computeTotalExposure(newRisks, nodes);
	return { total, currency, newRiskCount: newRisks.length };
}
