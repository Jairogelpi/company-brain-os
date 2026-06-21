import { NextResponse } from "next/server";
import { requireApiUser } from "@/auth/api-guard";
import { getLlmConfig, chatCompletion } from "@/ai/client";
import { retrieveContexts } from "@/server/rag/retrieve";
import { buildRagPrompt } from "@/server/rag/rag-prompt";
import { toCitation, citedListFallback } from "@/server/rag/citations";

/**
 * POST /api/chat — RAG Q&A endpoint.
 *
 * Body: { question: string }
 * Response: { answer: string, sources: Citation[] }
 *
 * Flow: authenticate → validate question → retrieve contexts (tenant-scoped)
 * → empty-graph short-circuit → low-confidence flag → LLM generate with
 * graceful fallback to a cited list when the LLM is unavailable or throws.
 */

export async function POST(request: Request) {
	const user = await requireApiUser();
	if (user instanceof NextResponse) return user;

	let body: { question?: unknown };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const question =
		typeof body.question === "string" ? body.question.trim() : "";
	if (!question) {
		return NextResponse.json(
			{ error: "question is required" },
			{ status: 400 },
		);
	}

	const contexts = await retrieveContexts(user.companyId, question);
	if (contexts.length === 0) {
		// Empty graph: do NOT call the LLM (R4.1, AC-12).
		return NextResponse.json({
			answer: "Not enough context yet.",
			sources: [],
		});
	}

	// Low-relevance: still answer, but flag low confidence (R4.2, AC-13).
	const lowConfidence = contexts[0].relevance < 0.2;

	const llmConfig = getLlmConfig();
	let answer: string;
	if (!llmConfig) {
		// LLM unavailable: cited-list fallback (R4.3, AC-14).
		answer = citedListFallback(contexts, lowConfidence);
	} else {
		try {
			const messages = buildRagPrompt(question, contexts, { lowConfidence });
			answer = await chatCompletion(messages, llmConfig);
		} catch {
			// chatCompletion threw: cited-list fallback, no unhandled error
			// (R4.3, AC-14). Single try/catch around chatCompletion only
			// (design D10 — retrieval/embedding failures surface as 500s).
			answer = citedListFallback(contexts, lowConfidence);
		}
	}

	return NextResponse.json({
		answer,
		sources: contexts.map(toCitation),
	});
}
