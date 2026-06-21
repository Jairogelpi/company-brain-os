"use client";

import { useState } from "react";
import {
	createInitialChatState,
	submitStart,
	submitSuccess,
	submitError,
	isSubmitDisabled,
	type ChatState,
} from "./chat-state";

/**
 * Minimal RAG Q&A client: input + submit + answer + cited sources.
 *
 * - Single-turn (no conversation history across submissions) — R5.4.
 * - No token streaming — the full answer is rendered from `res.json()` — R5.4.
 * - Loading state disables submit and shows a spinner — R5.3.
 * - Error state shows a message and re-enables submit — R5.3.
 */
export function ChatClient() {
	const [state, setState] = useState<ChatState>(createInitialChatState());
	const [input, setInput] = useState("");

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		const question = input.trim();
		if (!question || isSubmitDisabled(state)) return;

		setState((prev) => submitStart(prev, question));

		try {
			const res = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ question }),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as {
				answer: string;
				sources: ChatState["sources"];
			};
			setState((prev) => submitSuccess(prev, data.answer, data.sources ?? []));
		} catch (err) {
			setState((prev) =>
				submitError(
					prev,
					err instanceof Error ? err.message : "Request failed",
				),
			);
		}
	}

	return (
		<div className="mx-auto max-w-2xl space-y-6 p-6">
			<h1 className="text-2xl font-bold">Chat</h1>
			<form onSubmit={onSubmit} className="space-y-3">
				<textarea
					className="w-full rounded border p-3"
					placeholder="Ask a question about your organization…"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					rows={3}
					aria-label="Question"
				/>
				<button
					type="submit"
					className="rounded bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
					disabled={isSubmitDisabled(state)}
				>
					{state.status === "loading" ? "Asking…" : "Ask"}
				</button>
			</form>

			{state.status === "loading" && (
				<div role="status" aria-live="polite">
					Loading answer…
				</div>
			)}

			{state.status === "error" && state.error && (
				<div
					role="alert"
					className="rounded border border-red-400 p-3 text-red-700"
				>
					Error: {state.error}. Try again.
				</div>
			)}

			{state.answer ? (
				<section aria-label="Answer" className="space-y-2">
					<h2 className="font-semibold">Answer</h2>
					<div className="whitespace-pre-wrap">{state.answer}</div>
				</section>
			) : (
				<section aria-label="Answer" className="space-y-2">
					<h2 className="font-semibold">Answer</h2>
					<div className="text-muted-foreground">
						No answer yet — ask a question above.
					</div>
				</section>
			)}

			<section aria-label="Sources" className="space-y-2">
				<h2 className="font-semibold">Sources</h2>
				{state.sources.length > 0 ? (
					<ul className="space-y-1">
						{state.sources.map((s) => (
							<li key={s.nodeId} className="text-sm">
								<span className="font-medium">{s.nodeName}</span>{" "}
								<span className="text-muted-foreground">({s.nodeType})</span> —
								relevance {Math.round(s.relevance * 100)}%
							</li>
						))}
					</ul>
				) : (
					<div className="text-muted-foreground">No sources yet.</div>
				)}
			</section>
		</div>
	);
}
