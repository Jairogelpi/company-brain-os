/**
 * RAG prompt construction (pure, no network/DB).
 *
 * Builds a system + user `ChatMessage[]` that instructs the model to answer
 * strictly from the provided retrieved contexts and to cite each fact by
 * source number. Used by the `POST /api/chat` route.
 */

export type ChatMessage = {
	role: "system" | "user";
	content: string;
};

export type RetrievedContext = {
	nodeId: string;
	nodeName: string;
	nodeType: string;
	relevance: number; // cosine similarity in [0,1]
	content: string; // built via buildNodeContent
};

export function buildRagPrompt(
	question: string,
	contexts: RetrievedContext[],
	opts: { lowConfidence?: boolean } = {},
): ChatMessage[] {
	const contextBlock = contexts
		.map(
			(c, i) =>
				`[${i + 1}] ${c.nodeName} (${c.nodeType}) — relevance ${Math.round(c.relevance * 100)}%\n${c.content}`,
		)
		.join("\n\n");

	const system =
		`You are answering strictly from the provided context about the user's organization. ` +
		`Rules:\n` +
		`1. Answer ONLY using facts present in the context blocks below. ` +
		`2. Do not invent, extrapolate, or rely on prior knowledge. ` +
		`3. Cite each fact with the source number, e.g. "(source 2)". ` +
		`4. If the context does not contain the answer, say "I don't have enough context to answer that." ` +
		(opts.lowConfidence
			? `5. The top retrieved source has low relevance; state explicitly that this is a low confidence answer.\n`
			: ``);

	const user =
		`Question: ${question}\n\n` +
		`Context:\n${contextBlock}\n\n` +
		`Answer (cited, grounded only in the context above):`;

	return [
		{ role: "system", content: system },
		{ role: "user", content: user },
	];
}
