/**
 * OpenCode LLM client for interview entity extraction.
 *
 * Uses OpenAI-compatible API. The API key is injected at runtime.
 * Falls back gracefully to heuristic extraction on network errors.
 */

const OPENCODE_BASE_URL = "https://opencode.ai/zen/go/v1";

export type LlmConfig = {
	apiKey: string;
	baseUrl?: string;
	model?: string;
};

let defaultConfig: LlmConfig | null = null;

export function configureLlm(config: LlmConfig): void {
	defaultConfig = { baseUrl: OPENCODE_BASE_URL, model: "glm-5.2", ...config };
}

export function getLlmConfig(): LlmConfig | null {
	return defaultConfig;
}

type ChatMessage = {
	role: "system" | "user";
	content: string;
};

type ChatCompletionResponse = {
	choices: Array<{ message: { content: string } }>;
};

/**
 * Sends a chat completion request. Returns parsed text.
 * Throws on network/auth errors; callers should catch and fall back.
 */
export async function chatCompletion(
	messages: ChatMessage[],
	config?: LlmConfig,
): Promise<string> {
	const cfg = config ?? defaultConfig;
	if (!cfg) throw new Error("LLM not configured. Call configureLlm() first.");

	const response = await fetch(
		`${cfg.baseUrl ?? OPENCODE_BASE_URL}/chat/completions`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${cfg.apiKey}`,
			},
			body: JSON.stringify({
				model: cfg.model ?? "glm-5.2",
				messages,
				temperature: 0.1,
				max_tokens: 500,
			}),
		},
	);

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(
			`OpenCode API error ${response.status}: ${body.slice(0, 200)}`,
		);
	}

	const data = (await response.json()) as ChatCompletionResponse;
	const content = data.choices?.[0]?.message?.content;
	if (!content) throw new Error("Empty response from OpenCode API");

	return content;
}
