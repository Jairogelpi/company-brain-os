"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	AI_EVERY,
	QUESTION_BANK,
	type BankQuestion,
} from "@/domain/interview-bank";

type Turn = { q: string; a: string; ai: boolean };

export default function CapturePage() {
	const { can } = useAuth();
	const allowed = can("graph.node.create");

	const [bankIndex, setBankIndex] = useState(0);
	const [answered, setAnswered] = useState(0);
	const [aiQuestion, setAiQuestion] = useState<string | null>(null);
	const [loadingAi, setLoadingAi] = useState(false);
	const [history, setHistory] = useState<Turn[]>([]);
	const [input, setInput] = useState("");
	const [picked, setPicked] = useState("");
	const [level, setLevel] = useState("2");
	const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
	const [finishing, setFinishing] = useState(false);
	const [savedMsg, setSavedMsg] = useState("");
	const [err, setErr] = useState("");

	useEffect(() => {
		fetch("/api/people")
			.then((r) => (r.ok ? r.json() : { people: [] }))
			.then((d) => setPeople(d.people ?? []))
			.catch(() => {});
	}, [savedMsg]);

	const bankDone = bankIndex >= QUESTION_BANK.length;
	const currentBank: BankQuestion | undefined = bankDone
		? undefined
		: QUESTION_BANK[bankIndex];
	const isAi = aiQuestion !== null;
	const questionText = isAi ? (aiQuestion as string) : (currentBank?.text ?? "");
	const expectsPerson =
		!isAi && Boolean(currentBank?.expectsPerson || currentBank?.expectsSubstitute);
	const isSubstitute = !isAi && Boolean(currentBank?.expectsSubstitute);
	const areaLabel = isAi ? "Pregunta de IA" : (currentBank?.area ?? "");
	const finished = bankDone && !isAi && !loadingAi;

	async function afterAnswer(next: Turn[], newAnswered: number, wasAi: boolean) {
		if (wasAi) {
			setAiQuestion(null);
			return;
		}
		setBankIndex((i) => i + 1);
		// Every AI_EVERY bank answers, try to inject a company-specific AI question.
		if (newAnswered % AI_EVERY === 0) {
			setLoadingAi(true);
			try {
				const res = await fetch("/api/interview/ai-question", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						history: next.slice(-8).map((t) => ({ q: t.q, a: t.a })),
					}),
				});
				const d = (await res.json().catch(() => ({}))) as {
					question?: string | null;
				};
				if (d.question) setAiQuestion(d.question);
			} catch {
				// fall through to the bank
			}
			setLoadingAi(false);
		}
	}

	const submit = async () => {
		if (!allowed || loadingAi) return;
		let a = input.trim();
		if (expectsPerson) {
			if (!picked) return;
			a = isSubstitute ? `${picked} nivel ${level}` : picked;
		}
		if (!a) return;
		const turn: Turn = { q: questionText, a, ai: isAi };
		const wasAi = isAi;
		const next = [...history, turn];
		setHistory(next);
		setInput("");
		setPicked("");
		setLevel("2");
		const newAnswered = answered + 1;
		setAnswered(newAnswered);
		await afterAnswer(next, newAnswered, wasAi);
	};

	const finish = async () => {
		if (history.length === 0) return;
		setFinishing(true);
		setErr("");
		const transcript = history.map((t) => `${t.q} ${t.a}`).join(". ");
		const res = await fetch("/api/graph/build", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message: transcript }),
		});
		setFinishing(false);
		const d = (await res.json().catch(() => ({}))) as {
			reply?: string;
			error?: string;
		};
		if (!res.ok) {
			setErr(d.error ?? "No se pudo guardar.");
			return;
		}
		setSavedMsg(d.reply ?? "Guardado en el grafo.");
	};

	return (
		<div className="px-8 py-10 rise">
			<div className="border-b border-border pb-6">
				<div className="eyebrow">Adaptive interview</div>
				<h1 className="mt-2 text-4xl font-normal tracking-tight">
					Capture knowledge
				</h1>
				<p className="mt-2 max-w-xl text-sm text-muted-foreground">
					Responde en lenguaje natural. Cada {AI_EVERY} preguntas, la IA genera
					una específica de tu empresa. Al terminar, lo volcamos al grafo.
				</p>
			</div>

			{!allowed && (
				<Card className="mt-6 p-5 text-sm text-muted-foreground">
					Tu rol no puede capturar conocimiento. Pide a un contributor u owner.
				</Card>
			)}

			<div className="mt-8 grid gap-6 lg:grid-cols-5">
				<div className="lg:col-span-3">
					<div className="space-y-3">
						{history.map((turn, i) => (
							<Card key={i} className="p-4">
								<CardContent className="p-0">
									<div className="eyebrow flex items-center gap-2">
										{turn.ai && <Badge>IA</Badge>}
										{turn.q}
									</div>
									<p className="mt-1.5 text-sm text-foreground">{turn.a}</p>
								</CardContent>
							</Card>
						))}
					</div>

					{loadingAi && (
						<Card className="mt-3 border-l-2 border-l-foreground p-5">
							<CardContent className="p-0 text-sm text-muted-foreground">
								La IA está preparando una pregunta sobre tu empresa…
							</CardContent>
						</Card>
					)}

					{!loadingAi && !finished && (
						<Card className="mt-3 border-l-2 border-l-foreground p-5">
							<CardContent className="p-0">
								<div className="eyebrow flex items-center gap-2">
									{isAi && <Badge>IA</Badge>}
									{areaLabel}
								</div>
								<p className="mt-1.5 text-sm font-medium text-foreground">
									{questionText}
								</p>

								{expectsPerson ? (
									<div className="mt-4 flex flex-wrap gap-2">
										<select
											value={picked}
											onChange={(e) => setPicked(e.target.value)}
											disabled={!allowed}
											className="h-10 min-w-48 flex-1 rounded-md border border-border bg-background px-2 text-sm"
										>
											<option value="">Elige una persona…</option>
											{people.map((p) => (
												<option key={p.id} value={p.name}>
													{p.name}
												</option>
											))}
										</select>
										{isSubstitute && (
											<select
												value={level}
												onChange={(e) => setLevel(e.target.value)}
												disabled={!allowed}
												className="h-10 rounded-md border border-border bg-background px-2 text-sm"
												aria-label="Nivel del sustituto"
											>
												{[0, 1, 2, 3, 4, 5].map((n) => (
													<option key={n} value={n}>
														Nivel {n}
													</option>
												))}
											</select>
										)}
										<Button onClick={submit} disabled={!allowed || !picked}>
											Enviar
										</Button>
									</div>
								) : (
									<div className="mt-4 flex gap-2">
										<Input
											value={input}
											onChange={(e) => setInput(e.target.value)}
											onKeyDown={(e) => e.key === "Enter" && submit()}
											placeholder="Escribe tu respuesta…"
											disabled={!allowed}
											className="flex-1"
										/>
										<Button onClick={submit} disabled={!allowed || !input.trim()}>
											Enviar
										</Button>
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{finished && (
						<Card className="mt-3 border-l-2 border-l-foreground p-5">
							<CardContent className="p-0 text-sm text-muted-foreground">
								Has recorrido todas las preguntas. Pulsa{" "}
								<span className="font-medium text-foreground">
									Volcar al grafo
								</span>{" "}
								para guardar.
							</CardContent>
						</Card>
					)}

					<div className="eyebrow mt-3">{answered} respuestas</div>
				</div>

				<div className="lg:col-span-2">
					<Card className="p-5">
						<CardContent className="p-0">
							<div className="flex items-center justify-between">
								<span className="eyebrow">{history.length} capturadas</span>
								<Button
									size="sm"
									onClick={finish}
									disabled={finishing || !allowed || history.length === 0}
								>
									{finishing ? "Guardando…" : "Volcar al grafo"}
								</Button>
							</div>
							{err && (
								<p className="mt-2 text-xs font-medium text-destructive">{err}</p>
							)}
							<p className="mt-3 text-xs text-muted-foreground">
								La IA usa todo lo que ya sabe la empresa (el grafo) para hacer
								preguntas específicas y descubrir riesgos.
							</p>
						</CardContent>
					</Card>

					{savedMsg && (
						<Card className="mt-4 p-5">
							<CardContent className="p-0">
								<div className="eyebrow text-foreground">Guardado</div>
								<p className="mt-2 text-sm text-foreground">{savedMsg}</p>
								<div className="mt-3 flex gap-3 text-xs font-medium text-foreground">
									<Link href="/graph" className="hover:underline">
										Ver grafo →
									</Link>
									<Link href="/people" className="hover:underline">
										Ver personas →
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
