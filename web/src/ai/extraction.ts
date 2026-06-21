import type { InterviewQuestion, TextSignals } from "@/domain/interview";
import { chatCompletion, getLlmConfig, type LlmConfig } from "./client";

const SYSTEM_PROMPT = `You are a JSON-only entity extraction API. Your ONLY output must be a single JSON object. Never include explanations, markdown, or reasoning.

Extract these fields from Spanish interview answers (all optional, omit if not detected):
- personName: string — name of a key person mentioned
- knowledgeName: string — name of a specific knowledge, skill, or secret mentioned
- ruleName: string — name of an unwritten rule, policy, or norm
- processName: string — name of a business process mentioned
- substituteName: string — name of a possible substitute or backup person
- substituteLevel: number (0-5) — how close the substitute is to the expert (0=unrelated, 5=same level)
- critical: boolean — the answer describes something critical, indispensable, or high-risk
- covered: boolean — the knowledge is covered by multiple people or well distributed
- documented: boolean — the knowledge exists in writing, manuals, SOPs, or validated docs
- undocumented: boolean — the knowledge is explicitly NOT written or documented anywhere
- noSubstitute: boolean — there is genuinely no real substitute (not just "no one else does it exactly the same")

CRITICAL: Output raw JSON only. No markdown. No explanations. No reasoning. Start with { and end with }.
`;

function buildUserPrompt(text: string, question: InterviewQuestion): string {
	return `Probe type: ${question.probe}
Question purpose: ${question.purpose}
Interview question: ${question.text}

User's answer:
"${text}"

Extract the signals as JSON:`;
}

function parseSignals(raw: string): TextSignals {
	// The model may include reasoning before the JSON.
	// Find the last JSON object in the response.
	const matches = [
		...raw.matchAll(
			/\{[^}]*"personName"[^}]*\}|\{[^}]*"critical"[^}]*\}|\{(?:[^{}]|\{[^{}]*\})*\}/g,
		),
	];
	const lastJson = matches.length > 0 ? matches[matches.length - 1][0] : raw;
	const cleaned = lastJson
		.replace(/```(?:json)?\s*/g, "")
		.replace(/```/g, "")
		.trim();
	try {
		const parsed = JSON.parse(cleaned);
		return {
			personName: parsed.personName ?? undefined,
			knowledgeName: parsed.knowledgeName ?? undefined,
			ruleName: parsed.ruleName ?? undefined,
			processName: parsed.processName ?? undefined,
			substituteName: parsed.substituteName ?? undefined,
			substituteLevel:
				typeof parsed.substituteLevel === "number" &&
				!Number.isNaN(parsed.substituteLevel)
					? Math.max(0, Math.min(5, Math.round(parsed.substituteLevel)))
					: undefined,
			critical: parsed.critical === true,
			covered: parsed.covered === true,
			documented: parsed.documented === true,
			undocumented: parsed.undocumented === true,
			noSubstitute: parsed.noSubstitute === true,
		};
	} catch {
		// Fallback: return default (all false/undefined)
		return {
			critical: false,
			covered: false,
			documented: false,
			undocumented: false,
			noSubstitute: false,
		};
	}
}

/**
 * Analyzes an interview answer using the configured LLM.
 * Falls back to the heuristic analyzer on error.
 * Returns TextSignals compatible with the existing interview engine.
 */
export async function analyzeTextWithLLM(
	text: string,
	question: InterviewQuestion,
	heuristicFallback: (text: string) => TextSignals,
	config?: LlmConfig,
): Promise<TextSignals> {
	const cfg = config ?? getLlmConfig();
	if (!cfg) {
		// No LLM configured — use heuristic directly
		return heuristicFallback(text);
	}

	try {
		const content = await chatCompletion(
			[
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: buildUserPrompt(text, question) },
			],
			cfg,
		);
		return parseSignals(content);
	} catch (error) {
		// Network error, auth error, malformed response — fall back
		console.warn(
			"LLM extraction failed, falling back to heuristic:",
			(error as Error).message,
		);
		return heuristicFallback(text);
	}
}
