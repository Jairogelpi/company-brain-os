"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Msg = { role: "user" | "assistant"; text: string };

const INTRO: Msg = {
	role: "assistant",
	text: "Describe your operation in plain words and I'll build the graph. e.g. \"Pedro masters the bottling line and trains Laura on it.\"",
};

export type GraphBuildChatProps = {
	/** Re-fetch the graph after the assistant applies changes. */
	onBuilt: () => void;
};

export default function GraphBuildChat({ onBuilt }: GraphBuildChatProps) {
	const [messages, setMessages] = useState<Msg[]>([INTRO]);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	async function send() {
		const message = input.trim();
		if (!message || busy) return;
		setInput("");
		setMessages((m) => [...m, { role: "user", text: message }]);
		setBusy(true);
		try {
			const res = await fetch("/api/graph/build", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message }),
			});
			const body = (await res.json().catch(() => ({}))) as {
				reply?: string;
				error?: string;
			};
			const text = res.ok
				? (body.reply ?? "Done.")
				: (body.error ?? "Something went wrong.");
			setMessages((m) => [...m, { role: "assistant", text }]);
			if (res.ok) onBuilt();
		} catch {
			setMessages((m) => [
				...m,
				{ role: "assistant", text: "Network error — please try again." },
			]);
		} finally {
			setBusy(false);
			requestAnimationFrame(() => {
				scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
			});
		}
	}

	return (
		<div className="flex h-full w-80 flex-col border-l border-border bg-background">
			<div className="border-b border-border px-4 py-3">
				<div className="eyebrow">AI assistant</div>
				<div className="text-sm font-medium">Build with words</div>
			</div>

			<div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
				{messages.map((m, i) => (
					<div
						key={i}
						className={
							m.role === "user"
								? "ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-foreground px-3 py-2 text-xs text-background"
								: "mr-auto max-w-[90%] rounded-lg rounded-bl-sm bg-muted px-3 py-2 text-xs text-foreground"
						}
					>
						{m.text}
					</div>
				))}
				{busy && (
					<div className="mr-auto rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
						Thinking…
					</div>
				)}
			</div>

			<div className="border-t border-border p-3">
				<textarea
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							send();
						}
					}}
					placeholder="Describe people, knowledge, processes…"
					rows={2}
					className="w-full resize-none rounded-md border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
				/>
				<Button onClick={send} disabled={busy || !input.trim()} className="mt-2 w-full">
					Send
				</Button>
			</div>
		</div>
	);
}
