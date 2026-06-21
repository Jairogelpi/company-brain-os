"use client";

import { useState } from "react";
import Link from "next/link";
import {
	createInterviewSession,
	answerInterviewQuestion,
	type InterviewSession,
} from "@/domain/interview";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
		setSession(createInterviewSession());
		setHistory([]);
	};

	const f = session.facts;

	return (
		<div className="px-8 py-10 rise">
			<div className="border-b border-border pb-6">
				<div className="eyebrow">Adaptive interview</div>
				<h1 className="mt-2 text-4xl font-normal tracking-tight">
					Capture knowledge
				</h1>
				<p className="mt-2 max-w-xl text-sm text-muted-foreground">
					Answer in plain language. The engine extracts people, knowledge, and
					risks, then writes them to your graph.
				</p>
			</div>

			{!allowed && (
				<Card className="mt-6 p-5 text-sm text-muted-foreground">
					Your role can&apos;t capture knowledge. Ask a contributor or owner.
				</Card>
			)}

			<div className="mt-8 grid gap-6 lg:grid-cols-5">
				<div className="lg:col-span-3">
					<div className="space-y-3">
						{history.map((turn, i) => (
							<Card key={i} className="p-4">
								<CardContent className="p-0">
									<div className="eyebrow">{turn.q}</div>
									<p className="mt-1.5 text-sm text-foreground">{turn.a}</p>
								</CardContent>
							</Card>
						))}
					</div>

					<Card className="mt-3 border-l-2 border-l-foreground p-5">
						<CardContent className="p-0">
							<div className="eyebrow">{session.currentQuestion.probe}</div>
							<p className="mt-1.5 text-sm font-medium text-foreground">
								{session.currentQuestion.text}
							</p>
							<div className="mt-4 flex gap-2">
								<Input
									value={input}
									onChange={(e) => setInput(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && submit()}
									placeholder="Type your answer…"
									disabled={!allowed}
									className="flex-1"
								/>
								<Button onClick={submit} disabled={!allowed}>
									Send
								</Button>
							</div>
						</CardContent>
					</Card>

					<div className="eyebrow mt-3">
						{session.askedQuestions.length} questions asked
					</div>
				</div>

				<div className="lg:col-span-2">
					<Card className="p-5">
						<CardContent className="p-0">
							<div className="eyebrow">Extracted so far</div>
							<div className="mt-3 flex flex-wrap gap-1.5">
								{f.keyPerson && <Badge variant="secondary">{f.keyPerson.name}</Badge>}
								{f.knowledge && (
									<Badge variant="secondary">{f.knowledge.name}</Badge>
								)}
								{f.substitute && (
									<Badge variant="secondary">
										{f.substitute.name} (L{f.substitute.level})
									</Badge>
								)}
								{f.process && (
									<Badge variant="secondary">{f.process.name}</Badge>
								)}
								{f.rules.map((r) => (
									<Badge key={r.id} variant="destructive">
										{r.name}
									</Badge>
								))}
								{f.documented !== undefined && (
									<Badge variant={f.documented ? "secondary" : "destructive"}>
										{f.documented ? "Documented" : "Undocumented"}
									</Badge>
								)}
								{!f.keyPerson && !f.knowledge && f.rules.length === 0 && (
									<span className="text-sm text-muted-foreground">
										Nothing extracted yet.
									</span>
								)}
							</div>
						</CardContent>
					</Card>

					{session.alarms.length > 0 && (
						<Card className="mt-4 border-l-2 border-l-destructive p-5">
							<CardContent className="p-0">
								<div className="eyebrow text-destructive">First alarm</div>
								{session.alarms.map((a) => (
									<p
										key={a.id}
										className="mt-2 text-sm font-medium leading-relaxed text-foreground"
									>
										{a.message}
									</p>
								))}
							</CardContent>
						</Card>
					)}

					{session.proposals.length > 0 && (
						<Card className="mt-4 p-5">
							<CardContent className="p-0">
								<div className="flex items-center justify-between">
									<span className="eyebrow">
										{session.proposals.length} proposals pending
									</span>
									<Button
										size="sm"
										onClick={confirmAll}
										disabled={saving || !allowed}
									>
										{saving ? "Saving…" : "Confirm & save"}
									</Button>
								</div>
								{err && (
									<p className="mt-2 text-xs font-medium text-destructive">
										{err}
									</p>
								)}
							</CardContent>
						</Card>
					)}

					{saved !== null && (
						<Card className="mt-4 p-5">
							<CardContent className="p-0">
								<div className="eyebrow text-foreground">Saved</div>
								<p className="mt-2 text-sm text-foreground">
									{saved} graph operation{saved === 1 ? "" : "s"} written.
								</p>
								<div className="mt-3 flex gap-3 text-xs font-medium text-foreground">
									<Link href="/people" className="hover:underline">
										View People →
									</Link>
									<Link href="/" className="hover:underline">
										Dashboard →
									</Link>
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</div>
	);
}
