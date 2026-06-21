import type { GraphNode } from "./graph";
import type { DetectedRisk } from "./risk-engine";

/**
 * Financial risk exposure (change #4) — pure, no I/O.
 *
 * Turns a DetectedRisk into euros: the number a CFO reacts to. Always returns a
 * figure; when a node lacks a cost model, documented defaults are used and the
 * result is flagged `estimated` so the UI can label it.
 *
 * Cost model lives on node attributes (jsonb — no migration):
 *   Process/Knowledge: downtimeCostPerDay (€/day), recoveryDays
 *   Person:            replacementCost (€), replacementWeeks
 */

export const CURRENCY = "EUR";
// ponytail: global defaults — move to per-company config when tenants need it.
export const DEFAULT_DOWNTIME_COST_PER_DAY = 1000;
export const DEFAULT_RECOVERY_DAYS = 5;
export const DEFAULT_REPLACEMENT_COST = 5000;

export interface RiskExposure {
	exposure: number;
	currency: string;
	estimated: boolean;
	downtimeCostPerDay: number;
	recoveryDays: number;
	replacementCost: number;
}

export interface TotalExposure {
	total: number;
	currency: string;
}

/** Format a euro amount compactly (e.g. €18,000 / €1.2M). */
export function formatMoney(n: number, currency = CURRENCY): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
		maximumFractionDigits: n >= 10000 ? 0 : 2,
		notation: n >= 1_000_000 ? "compact" : "standard",
	}).format(n);
}

function num(v: unknown): number | undefined {
	return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/** Exposure for one risk: downtimeCostPerDay × recoveryDays + replacementCost. */
export function computeRiskExposure(
	risk: DetectedRisk,
	nodes: GraphNode[],
): RiskExposure {
	const source = nodes.find((n) => n.id === risk.sourceNodeId);
	let estimated = false;

	const dcpd = num(source?.attributes?.downtimeCostPerDay);
	const downtimeCostPerDay = dcpd ?? DEFAULT_DOWNTIME_COST_PER_DAY;
	if (dcpd === undefined) estimated = true;

	const rd = num(source?.attributes?.recoveryDays);
	const recoveryDays = rd ?? DEFAULT_RECOVERY_DAYS;
	if (rd === undefined) estimated = true;

	// Replacement cost from the first related Person (the expert at risk).
	const person = risk.relatedNodeIds
		.map((id) => nodes.find((n) => n.id === id))
		.find((n) => n?.type === "Person");
	let replacementCost = 0;
	if (person) {
		const rc = num(person.attributes?.replacementCost);
		replacementCost = rc ?? DEFAULT_REPLACEMENT_COST;
		if (rc === undefined) estimated = true;
	}

	return {
		exposure: downtimeCostPerDay * recoveryDays + replacementCost,
		currency: CURRENCY,
		estimated,
		downtimeCostPerDay,
		recoveryDays,
		replacementCost,
	};
}

/**
 * Aggregate exposure across risks, de-duplicated by the primary at-risk node
 * (worst-case per node) so one critical node is never counted twice.
 */
export function computeTotalExposure(
	risks: DetectedRisk[],
	nodes: GraphNode[],
): TotalExposure {
	const byNode = new Map<string, number>();
	for (const r of risks) {
		const { exposure } = computeRiskExposure(r, nodes);
		byNode.set(
			r.sourceNodeId,
			Math.max(byNode.get(r.sourceNodeId) ?? 0, exposure),
		);
	}
	let total = 0;
	for (const v of byNode.values()) total += v;
	return { total, currency: CURRENCY };
}

/** Build a knowledgeId → exposure map for the succession playbook's prioritization. */
export function exposureByNode(
	risks: DetectedRisk[],
	nodes: GraphNode[],
): Record<string, number> {
	const out: Record<string, number> = {};
	for (const r of risks) {
		const { exposure } = computeRiskExposure(r, nodes);
		out[r.sourceNodeId] = Math.max(out[r.sourceNodeId] ?? 0, exposure);
	}
	return out;
}
