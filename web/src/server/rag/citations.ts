/**
 * Citation type and helpers for the RAG Q&A route.
 *
 * A `Citation` is the public API shape returned in `sources[]`. `toCitation`
 * maps a `RetrievedContext` to a `Citation`, clamping `relevance` to `[0,1]`
 * to absorb float drift from `1 - cosine_distance`.
 */

import type { RetrievedContext } from "./rag-prompt";

export type Citation = {
	nodeId: string;
	nodeName: string;
	nodeType: string;
	relevance: number; // cosine similarity in [0,1]
};

function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 0;
	if (n < 0) return 0;
	if (n > 1) return 1;
	return n;
}

export function toCitation(ctx: RetrievedContext): Citation {
	return {
		nodeId: ctx.nodeId,
		nodeName: ctx.nodeName,
		nodeType: ctx.nodeType,
		relevance: clamp01(ctx.relevance),
	};
}

/**
 * Fallback answer when the LLM is unavailable (null config or chatCompletion
 * throws). Summarizes the top retrieved sources as a cited list, matching the
 * existing fallback posture in `consultant.ts` / `wiki-generator.ts`.
 */
export function citedListFallback(
	contexts: RetrievedContext[],
	lowConfidence: boolean = false,
): string {
	if (contexts.length === 0) {
		return "Not enough context yet.";
	}
	const header = lowConfidence
		? "Confidence is low. Top retrieved sources (relevance may be weak):"
		: "Top retrieved sources:";
	const lines = contexts
		.slice(0, 5)
		.map(
			(c, i) =>
				`${i + 1}. ${c.nodeName} (${c.nodeType}) — relevance ${Math.round(c.relevance * 100)}%`,
		)
		.join("\n");
	return `${header}\n${lines}`;
}
