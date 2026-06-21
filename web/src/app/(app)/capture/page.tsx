"use client";

import { useState } from "react";
import Link from "next/link";
import {
	createInterviewSession,
	answerInterviewQuestion,
	type InterviewSession,
} from "@/domain/interview";
import { useAuth } from "@/components/auth/AuthProvider";

export default function CapturePage() {
	const { can } = useAuth();
	const [session, setSession] = useState<InterviewSession>(() =>
		createInterviewSession(),
	);
	const [input, setInput] = useState("");
	const [history, setHistory] = useState<{ q: string; a: string }[]>([]);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState<number | null>(null);
	const [err, setErr] = useState("");

	const allowed = can("graph.node.create");

	const submit = () => {
		const text = input.trim();
		if (!text) return;
		setHistory((h) => [...h, { q: session.currentQuestion.text, a: text }]);
		setSession(answerInterviewQuestion(session, text));
		setInput("");
		setSaved(null);
	};

	const confirmAll = async () => {
		if (session.proposals.length === 0) return;
		setSaving(true);
		setErr("");
		const decisions = session.proposals.map((_, i) => ({
			proposalIndex: i,
			decision: "approve" as const,
		}));
		const res = await fetch("/api/graph/proposals", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ proposals: session.proposals, decisions }),
		});
		setSaving(false);
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			setErr(body.error ?? "Failed to save.");
			return;
		}
		const body = await res.json();
		setSaved(body.applied ?? 0);
		// Start a fresh session; captured knowledge now lives in the DB.
		setSession(createInterviewSession());
		setHistory([]);
	};

	const f = session.facts;

	return (
		<div className="px-8 py-10 rise">
			<div className="border-b border-[var(--hairline)] pb-6">
				<div className="eyebrow">Adaptive interview</div>
				<h1 className="mt-2 font-display text-4xl font-normal tracking-tight">
					Capture knowledge
				</h1>
				<p className="mt-2 max-w-xl text-sm text-[var(--ink-2)]">
					Answer in plain language. The engine extracts people, knowledge, and
					risks, then writes them to your graph.
				</p>
			</div>

			{!allowed && (
				<div className="panel mt-6 p-5 text-sm text-[var(--ink-2)]">
					Your role can&apos;t capture knowledge. Ask a contributor or owner.
				</div>
			)}

			<div className="mt-8 grid gap-6 lg:grid-cols-5">
				{/* Interview */}
				<div className="lg:col-span-3">
					{/* History */}
					<div className="space-y-3">
						{history.map((turn, i) => (
							<div key={i} className="panel-flat p-4">
								<div className="eyebrow">{turn.q}</div>
								<p className="mt-1.5 text-sm text-[var(--ink)]">{turn.a}</p>
							</div>
						))}
					</div>

					{/* Current question */}
					<div className="panel tick-left mt-3 p-5">
						<div className="eyebrow">{session.currentQuestion.probe}</div>
						<p className="mt-1.5 text-sm font-medium text-[var(--ink)]">
							{session.currentQuestion.text}
						</p>
						<div className="mt-4 flex gap-2">
							<input
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && submit()}
								placeholder="Type your answer…"
								disabled={!allowed}
								className="flex-1 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none transition-all placeholder:text-[var(--ink-3)] focus:border-[var(--cobalt)] focus:ring-2 focus:ring-[var(--cobalt)]/15 disabled:opacity-50"
							/>
							<button
								onClick={submit}
								disabled={!allowed}
								className="rounded-xl bg-[var(--ink)] px-5 text-sm font-medium text-[var(--paper)] transition-colors hover:bg-[var(--cobalt-ink)] disabled:opacity-50"
							>
								Send
							</button>
						</div>
					</div>

					<div className="eyebrow mt-3">
						{session.askedQuestions.length} questions asked
					</div>
				</div>

				{/* Live extraction */}
				<div className="lg:col-span-2">
					<div className="panel p-5">
						<div className="eyebrow">Extracted so far</div>
						<div className="mt-3 flex flex-wrap gap-1.5">
							{f.keyPerson && <Chip tone="cobalt">{f.keyPerson.name}</Chip>}
							{f.knowledge && <Chip tone="gold">{f.knowledge.name}</Chip>}
							{f.substitute && (
								<Chip>
									{f.substitute.name} (L{f.substitute.level})
								</Chip>
							)}
							{f.process && <Chip tone="ok">{f.process.name}</Chip>}
							{f.rules.map((r) => (
								<Chip key={r.id} tone="risk">
									{r.name}
								</Chip>
							))}
							{f.documented !== undefined && (
								<Chip tone={f.documented ? "ok" : "risk"}>
									{f.documented ? "Documented" : "Undocumented"}
								</Chip>
							)}
							{!f.keyPerson && !f.knowledge && f.rules.length === 0 && (
								<span className="text-sm text-[var(--ink-3)]">
									Nothing extracted yet.
								</span>
							)}
						</div>
					</div>

					{session.alarms.length > 0 && (
						<div className="panel tick-left mt-4 p-5">
							<div className="eyebrow text-[var(--risk)]">First alarm</div>
							{session.alarms.map((a) => (
								<p
									key={a.id}
									className="mt-2 text-sm font-medium leading-relaxed text-[var(--ink)]"
								>
									{a.message}
								</p>
							))}
						</div>
					)}

					{session.proposals.length > 0 && (
						<div className="panel mt-4 p-5">
							<div className="flex items-center justify-between">
								<span className="eyebrow">
									{session.proposals.length} proposals pending
								</span>
								<button
									onClick={confirmAll}
									disabled={saving || !allowed}
									className="rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--paper)] transition-colors hover:bg-[var(--cobalt-ink)] disabled:opacity-50"
								>
									{saving ? "Saving…" : "Confirm & save"}
								</button>
							</div>
							{err && (
								<p className="mt-2 text-xs font-medium text-[var(--risk)]">
									{err}
								</p>
							)}
						</div>
					)}

					{saved !== null && (
						<div className="panel mt-4 p-5">
							<div className="eyebrow text-[var(--positive)]">Saved</div>
							<p className="mt-2 text-sm text-[var(--ink)]">
								{saved} graph operation{saved === 1 ? "" : "s"} written.
							</p>
							<div className="mt-3 flex gap-3 text-xs font-medium text-[var(--cobalt)]">
								<Link href="/people" className="hover:underline">
									View People →
								</Link>
								<Link href="/" className="hover:underline">
									Dashboard →
								</Link>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function Chip({
	children,
	tone,
}: {
	children: React.ReactNode;
	tone?: "cobalt" | "gold" | "ok" | "risk";
}) {
	const color =
		tone === "cobalt"
			? "var(--cobalt-ink)"
			: tone === "gold"
				? "var(--gold)"
				: tone === "ok"
					? "var(--positive)"
					: tone === "risk"
						? "var(--risk)"
						: "var(--ink-2)";
	return (
		<span
			className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
			style={{ borderColor: "var(--hairline-strong)", color }}
		>
			{children}
		</span>
	);
}
