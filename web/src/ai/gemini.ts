/**
 * Minimal Google Gemini client (REST, no SDK).
 *
 * Server-only. Reads GEMINI_API_KEY (free tier from Google AI Studio) and an
 * optional GEMINI_MODEL (default gemini-2.5-flash — fast and free-tier
 * friendly; set GEMINI_MODEL=gemini-2.5-pro for the strongest model).
 *
 * Everything is best-effort: when the key is missing or the call fails the
 * caller falls back (e.g. to the fixed question bank), so the product keeps
 * working without an API key.
 */

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash";

export type GeminiConfig = { apiKey: string; model: string };

export function getGeminiConfig(): GeminiConfig | null {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) return null;
	return { apiKey, model: process.env.GEMINI_MODEL || DEFAULT_MODEL };
}

type GenerateOptions = {
	temperature?: number;
	maxOutputTokens?: number;
	/**
	 * Gemini 2.5 models "think" before answering, and thinking tokens count
	 * against maxOutputTokens — which can swallow the whole budget and truncate
	 * the answer. Default 0 disables thinking for short, direct tasks.
	 */
	thinkingBudget?: number;
};

/**
 * Single-prompt text generation. Throws on network/API errors — callers catch
 * and fall back. Returns the model's plain-text output (trimmed).
 */
export async function geminiGenerate(
	prompt: string,
	config: GeminiConfig,
	options: GenerateOptions = {},
): Promise<string> {
	const res = await fetch(
		`${BASE_URL}/models/${config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contents: [{ parts: [{ text: prompt }] }],
				generationConfig: {
					temperature: options.temperature ?? 0.7,
					maxOutputTokens: options.maxOutputTokens ?? 512,
					thinkingConfig: { thinkingBudget: options.thinkingBudget ?? 0 },
				},
			}),
		},
	);

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 200)}`);
	}

	const data = (await res.json()) as {
		candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
	};
	const text = data.candidates?.[0]?.content?.parts
		?.map((p) => p.text ?? "")
		.join("")
		.trim();
	if (!text) throw new Error("Empty response from Gemini");
	return text;
}
