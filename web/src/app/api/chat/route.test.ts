import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import type { RetrievedContext } from "@/server/rag/rag-prompt";

// --- Mocks ---

const requireApiUserMock = vi.fn();
const retrieveContextsMock = vi.fn();
const getLlmConfigMock = vi.fn();
const chatCompletionMock = vi.fn();

vi.mock("@/auth/api-guard", () => ({
	requireApiUser: requireApiUserMock,
}));
vi.mock("@/server/rag/retrieve", () => ({
	retrieveContexts: retrieveContextsMock,
}));
vi.mock("@/ai/client", () => ({
	getLlmConfig: getLlmConfigMock,
	chatCompletion: chatCompletionMock,
}));

// Import route after mocks are registered.
const { POST } = await import("./route");

// --- Helpers ---

function authedUser(companyId = "companyA") {
	return {
		id: "u1",
		name: "Tester",
		email: "t@t.com",
		companyId,
		role: "viewer" as const,
		validationDomains: [] as string[],
	};
}

function ctx(
	nodeId: string,
	nodeName: string,
	nodeType: string,
	relevance: number,
	content = "some content",
): RetrievedContext {
	return { nodeId, nodeName, nodeType, relevance, content };
}

function request(body: unknown): Request {
	return new Request("http://localhost/api/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

async function call(body: unknown) {
	const res = await POST(request(body));
	return { status: res.status, json: await res.json() };
}

// --- Tests ---

describe("POST /api/chat", () => {
	beforeEach(() => {
		requireApiUserMock.mockReset();
		retrieveContextsMock.mockReset();
		getLlmConfigMock.mockReset();
		chatCompletionMock.mockReset();
	});

	it("returns 400 for an empty question and does not retrieve", async () => {
		requireApiUserMock.mockResolvedValue(authedUser());
		const { status, json } = await call({ question: "" });
		expect(status).toBe(400);
		expect(json.error).toBeDefined();
		expect(retrieveContextsMock).not.toHaveBeenCalled();
	});

	it("returns 400 for a whitespace-only question", async () => {
		requireApiUserMock.mockResolvedValue(authedUser());
		const { status } = await call({ question: "   " });
		expect(status).toBe(400);
		expect(retrieveContextsMock).not.toHaveBeenCalled();
	});

	it("returns 401 when requireApiUser returns a 401 NextResponse", async () => {
		requireApiUserMock.mockResolvedValue(
			NextResponse.json({ error: "Authentication required." }, { status: 401 }),
		);
		const { status } = await call({ question: "q" });
		expect(status).toBe(401);
		expect(retrieveContextsMock).not.toHaveBeenCalled();
	});

	it("returns 200 with answer + non-empty sources for an authenticated tenant", async () => {
		requireApiUserMock.mockResolvedValue(authedUser());
		retrieveContextsMock.mockResolvedValue([
			ctx("n1", "Filler", "Knowledge", 0.91),
		]);
		getLlmConfigMock.mockReturnValue({ apiKey: "k", model: "m" });
		chatCompletionMock.mockResolvedValue("Pedro knows the filler config (source 1).");

		const { status, json } = await call({ question: "who knows the filler?" });
		expect(status).toBe(200);
		expect(typeof json.answer).toBe("string");
		expect(json.answer.length).toBeGreaterThan(0);
		expect(json.sources).toHaveLength(1);
		expect(json.sources[0].nodeId).toBe("n1");
		expect(json.sources[0].nodeName).toBe("Filler");
		expect(json.sources[0].nodeType).toBe("Knowledge");
		expect(json.sources[0].relevance).toBeCloseTo(0.91, 5);
	});

	it("enforces tenant isolation: companyB nodeIds are filtered from sources", async () => {
		requireApiUserMock.mockResolvedValue(authedUser("companyA"));
		// retrieveContexts is the pipeline boundary; it already filters by
		// companyId. We assert the route passes companyId through and only
		// returns the filtered contexts as sources.
		retrieveContextsMock.mockImplementation(async (companyId: string) =>
			companyId === "companyA"
				? [ctx("n-a", "Filler", "Knowledge", 0.9)]
				: [ctx("n-b", "Other", "Knowledge", 0.8)],
		);
		getLlmConfigMock.mockReturnValue({ apiKey: "k" });
		chatCompletionMock.mockResolvedValue("answer");

		const { json } = await call({ question: "q" });
		const ids = json.sources.map((s: { nodeId: string }) => s.nodeId);
		expect(ids).toContain("n-a");
		expect(ids).not.toContain("n-b");
	});

	it("returns 200 'Not enough context yet.' with sources:[] when graph is empty and does not call the LLM", async () => {
		requireApiUserMock.mockResolvedValue(authedUser());
		retrieveContextsMock.mockResolvedValue([]);

		const { status, json } = await call({ question: "q" });
		expect(status).toBe(200);
		expect(json.answer).toContain("Not enough context");
		expect(json.sources).toEqual([]);
		expect(getLlmConfigMock).not.toHaveBeenCalled();
		expect(chatCompletionMock).not.toHaveBeenCalled();
	});

	it("returns a low-confidence answer with cited sources when top relevance < 0.2", async () => {
		requireApiUserMock.mockResolvedValue(authedUser());
		retrieveContextsMock.mockResolvedValue([
			ctx("n1", "Weak", "Knowledge", 0.15),
		]);
		getLlmConfigMock.mockReturnValue({ apiKey: "k" });
		chatCompletionMock.mockResolvedValue(
			"I have low confidence. The closest source is 'Weak' (source 1).",
		);

		const { status, json } = await call({ question: "unrelated question" });
		expect(status).toBe(200);
		expect(json.sources).toHaveLength(1);
		// The low-confidence flag should flow into the prompt — assert the
		// chatCompletion was called with a system message containing "low confidence".
		const msgs = chatCompletionMock.mock.calls[0][0] as Array<{
			role: string;
			content: string;
		}>;
		expect(msgs[0].content.toLowerCase()).toContain("low confidence");
	});

	it("falls back to a cited list when getLlmConfig() returns null (no chatCompletion call)", async () => {
		requireApiUserMock.mockResolvedValue(authedUser());
		retrieveContextsMock.mockResolvedValue([
			ctx("n1", "Filler", "Knowledge", 0.9),
		]);
		getLlmConfigMock.mockReturnValue(null);

		const { status, json } = await call({ question: "q" });
		expect(status).toBe(200);
		expect(json.sources).toHaveLength(1);
		expect(json.answer).toContain("Filler");
		expect(chatCompletionMock).not.toHaveBeenCalled();
	});

	it("falls back to a cited list when chatCompletion throws (no unhandled error)", async () => {
		requireApiUserMock.mockResolvedValue(authedUser());
		retrieveContextsMock.mockResolvedValue([
			ctx("n1", "Filler", "Knowledge", 0.9),
		]);
		getLlmConfigMock.mockReturnValue({ apiKey: "k" });
		chatCompletionMock.mockRejectedValue(new Error("LLM down"));

		const { status, json } = await call({ question: "q" });
		expect(status).toBe(200);
		expect(json.sources).toHaveLength(1);
		expect(json.answer).toContain("Filler");
	});

	it("proceeds with retrieval when embed falls back to simpleEmbed (embed is internal to retrieveContexts)", async () => {
		requireApiUserMock.mockResolvedValue(authedUser());
		// retrieveContexts is mocked, but we assert the route still calls it
		// and returns 200 — the embeddings fallback is internal to embed().
		retrieveContextsMock.mockResolvedValue([
			ctx("n1", "Filler", "Knowledge", 0.7),
		]);
		getLlmConfigMock.mockReturnValue(null);

		const { status } = await call({ question: "q" });
		expect(status).toBe(200);
		expect(retrieveContextsMock).toHaveBeenCalledWith(
			"companyA",
			"q",
		);
	});
});
