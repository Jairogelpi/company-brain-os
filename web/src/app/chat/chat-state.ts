/**
 * Pure state machine for the /chat client UI.
 *
 * Extracted from the React component so the submit/loading/error/no-history
 * contract (spec R5.3, R5.4) is unit-testable without a DOM environment
 * (the project has no happy-dom/jsdom/@testing-library installed; vitest
 * runs in the node environment and only includes `*.test.ts`).
 */

export type Citation = {
	nodeId: string;
	nodeName: string;
	nodeType: string;
	relevance: number;
};

export type ChatStatus = "idle" | "loading" | "error";

export type ChatState = {
	question: string;
	answer: string | null;
	sources: Citation[];
	status: ChatStatus;
	error: string | null;
};

export function createInitialChatState(): ChatState {
	return {
		question: "",
		answer: null,
		sources: [],
		status: "idle",
		error: null,
	};
}

/** Transition to loading when a submit starts. Prior answer is preserved
 *  while the request is in flight (R5.3); error is cleared. */
export function submitStart(prev: ChatState, question: string): ChatState {
	return {
		...prev,
		question,
		status: "loading",
		error: null,
	};
}

/** Transition to idle with the answer + sources on a successful response. */
export function submitSuccess(
	prev: ChatState,
	answer: string,
	sources: Citation[],
): ChatState {
	return {
		...prev,
		answer,
		sources,
		status: "idle",
		error: null,
	};
}

/** Transition to error with a message; submit is re-enabled (R5.3). */
export function submitError(prev: ChatState, error: string): ChatState {
	return {
		...prev,
		status: "error",
		error,
	};
}

/** Submit control is disabled only while loading (R5.3). */
export function isSubmitDisabled(state: ChatState): boolean {
	return state.status === "loading";
}
