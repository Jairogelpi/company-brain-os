import { describe, expect, it } from "vitest";
import {
	createInitialChatState,
	submitStart,
	submitSuccess,
	submitError,
	type ChatState,
	type Citation,
} from "./chat-state";

const cite = (
	nodeId: string,
	nodeName: string,
	nodeType: string,
	relevance: number,
): Citation => ({ nodeId, nodeName, nodeType, relevance });

describe("createInitialChatState", () => {
	it("starts idle with no answer, no sources, empty question", () => {
		const s = createInitialChatState();
		expect(s.status).toBe("idle");
		expect(s.question).toBe("");
		expect(s.answer).toBeNull();
		expect(s.sources).toEqual([]);
		expect(s.error).toBeNull();
	});
});

describe("submitStart", () => {
	it("transitions to loading, clears error, disables submit (keeps prior answer)", () => {
		const prev: ChatState = {
			question: "old q",
			answer: "old answer",
			sources: [cite("n1", "A", "Knowledge", 0.5)],
			status: "idle",
			error: "boom",
		};
		const s = submitStart(prev, "new question");
		expect(s.status).toBe("loading");
		expect(s.question).toBe("new question");
		expect(s.error).toBeNull();
		// prior answer preserved while loading (R5.3)
		expect(s.answer).toBe("old answer");
	});
});

describe("submitSuccess", () => {
	it("transitions to idle with answer + sources, clears error", () => {
		const prev: ChatState = {
			question: "q",
			answer: null,
			sources: [],
			status: "loading",
			error: null,
		};
		const sources = [cite("n1", "Filler", "Knowledge", 0.91)];
		const s = submitSuccess(prev, "the answer", sources);
		expect(s.status).toBe("idle");
		expect(s.answer).toBe("the answer");
		expect(s.sources).toEqual(sources);
		expect(s.error).toBeNull();
	});
});

describe("submitError", () => {
	it("transitions to error with a message, keeps submit re-enabled", () => {
		const prev: ChatState = {
			question: "q",
			answer: null,
			sources: [],
			status: "loading",
			error: null,
		};
		const s = submitError(prev, "Request failed");
		expect(s.status).toBe("error");
		expect(s.error).toBe("Request failed");
		// re-submit allowed: status is error (not loading), submit not disabled
		expect(s.status).not.toBe("loading");
	});
});

describe("single-turn (no conversation history)", () => {
	it("a second submit resets answer/sources via the loading -> success cycle", () => {
		let s = createInitialChatState();
		s = submitStart(s, "first question");
		s = submitSuccess(s, "first answer", [cite("n1", "A", "Knowledge", 0.9)]);
		expect(s.answer).toBe("first answer");

		// Second question: submitStart does NOT retain the first answer as
		// history — it preserves it only during loading, then success
		// overwrites it. There is no message array.
		s = submitStart(s, "second question");
		// During loading the prior answer is shown, but it's a single slot,
		// not a history array.
		expect(s.answer).toBe("first answer");
		s = submitSuccess(s, "second answer", [cite("n2", "B", "Person", 0.7)]);
		expect(s.answer).toBe("second answer");
		expect(s.sources).toHaveLength(1);
		expect(s.sources[0].nodeId).toBe("n2");
		// First answer is gone — no history retained (R5.4).
		expect(s.sources.find((c) => c.nodeId === "n1")).toBeUndefined();
	});
});

describe("isSubmitDisabled", () => {
	it("is true when loading, false otherwise", async () => {
		const { isSubmitDisabled } = await import("./chat-state");
		let s = createInitialChatState();
		expect(isSubmitDisabled(s)).toBe(false);
		s = submitStart(s, "q");
		expect(isSubmitDisabled(s)).toBe(true);
		s = submitSuccess(s, "a", []);
		expect(isSubmitDisabled(s)).toBe(false);
		s = submitError(s, "err");
		expect(isSubmitDisabled(s)).toBe(false);
	});
});
