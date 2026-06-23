"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useGraph } from "@/components/useGraph";
import { getLlmConfig } from "@/ai/client";
import { enrichPlaybookWithLLM } from "@/ai/succession-enrichment";
import {
	generatePlaybook,
	type PlaybookAction,
	type Playbook,
} from "@/domain/succession";
import { detectAllRisks } from "@/domain/risk-engine";
import { exposureByNode } from "@/domain/financial-exposure";
import {
	VALID_TRANSITIONS,
	type Mission,
	type MissionStatus,
} from "@/domain/missions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SuccessionPage() {
	const { can } = useAuth();
	const allowed = can("mission.create");
	const { data } = useGraph();

	const [personId, setPersonId] = useState("");
	const [lastDay, setLastDay] = useState("");
	const [playbook, setPlaybook] = useState<Playbook | null>(null);
	const [missions, setMissions] = useState<Mission[]>([]);
	const [msg, setMsg] = useState("");
	const [err, setErr] = useState("");
	const [loading, setLoading] = useState(false);

	const people = useMemo(
		() => (data?.nodes ?? []).filter((n) => n.type === "Person"),
		[data],
	);

	const loadMissions = useCallback(async () => {
		const res = await fetch("/api/missions");
		if (res.ok) setMissions((await res.json()).items);
	}, []);

	useEffect(() => {
		loadMissions();
	}, [loadMissions]);

	const generate = async () => {
		if (!data || !personId) return;
		setMsg("");
		setErr("");
		setLoading(true);
		const exposure = exposureByNode(
			detectAllRisks(data.nodes, data.edges).risks,
			data.nodes,
		);
		const heuristic = generatePlaybook(personId, data, {
			lastDay: lastDay || undefined,
			exposure,
		});
		try {
			const cfg = getLlmConfig();
			setPlaybook(
				cfg
					? await enrichPlaybookWithLLM(heuristic, data, { llm: cfg })
					: heuristic,
			);
		} catch {
			setPlaybook(heuristic);
		} finally {
			setLoading(false);
		}
	};

	const save = async () => {
		if (!playbook || playbook.actions.length === 0) return;
		setErr("");
		const res = await fetch("/api/missions", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				personId: playbook.personId,
				actions: playbook.actions,
			}),
		});
		if (!res.ok) {
			const b = await res.json().catch(() => ({}));
			return setErr(b.error ?? "Could not save.");
		}
		const b = await res.json();
		setMsg(`Saved ${b.saved} mission(s).`);
		setPlaybook(null);
		await loadMissions();
	};

	const transition = async (id: string, to: MissionStatus) => {
		const res = await fetch("/api/missions", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id, to }),
		});
		if (res.ok) await loadMissions();
		else
			setErr(
				(await res.json().catch(() => ({}))).error ?? "Transition failed.",
			);
	};

	const actionMarkdown = (a: PlaybookAction, i: number) => [
		`${i + 1}. **${a.action}** ${a.targetDate ? `(by ${a.targetDate})` : ""} — ${a.criticality ?? "—"}, bus factor ${a.busFactor}`,
		...(a.suggestedTrainerName
			? [`   - Suggested trainer: ${a.suggestedTrainerName}`]
			: []),
		...(a.rationale ? [`   - Rationale: ${a.rationale}`] : []),
		...(a.riskNote ? [`   - Risk: ${a.riskNote}`] : []),
		...(a.detailedSteps?.length
			? ["   - Steps:", ...a.detailedSteps.map((s) => `     - ${s}`)]
			: []),
	];

	const copyMarkdown = () => {
		const pb = playbook;
		const lines = pb
			? [
					`# Succession plan — ${pb.personName}`,
					pb.lastDay ? `Last day: ${pb.lastDay}` : "",
					"",
					...pb.actions.flatMap(actionMarkdown),
				]
			: missions.map(
					(m) =>
						`- [${m.status}] ${m.objective} ${m.dueDate ? `(by ${m.dueDate})` : ""}`,
				);
		navigator.clipboard?.writeText(lines.filter(Boolean).join("\n"));
		setMsg("Copied to clipboard.");
	};

	return (
		<div className="px-8 py-10 rise">
			<div className="border-b border-border pb-6">
				<div className="eyebrow">The day someone resigns</div>
				<h1 className="mt-2 text-4xl font-normal tracking-tight">
					Succession playbook
				</h1>
				<p className="mt-2 max-w-xl text-sm text-muted-foreground">
					Pick a departing person and their last day — get a prioritized, dated
					knowledge-transfer plan.
				</p>
			</div>

			<Card className="mt-8 flex flex-wrap items-end gap-4 p-5">
				<label className="flex flex-col gap-1">
					<span className="eyebrow">Departing person</span>
					<select
						value={personId}
						onChange={(e) => setPersonId(e.target.value)}
						disabled={!allowed}
						className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground disabled:opacity-50"
					>
						<option value="">Select…</option>
						{people.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</select>
				</label>
				<label className="flex flex-col gap-1">
					<span className="eyebrow">Last working day</span>
					<Input
						type="date"
						value={lastDay}
						onChange={(e) => setLastDay(e.target.value)}
						disabled={!allowed}
						className="rounded-xl"
					/>
				</label>
				<Button onClick={generate} disabled={!allowed || !personId || loading}>
					{loading ? "Enriching plan…" : "Generate plan"}
				</Button>
			</Card>

			{err && (
				<p className="mt-4 text-sm font-medium text-destructive">{err}</p>
			)}
			{msg && <p className="mt-4 text-sm text-foreground">{msg}</p>}
			{loading && (
				<p className="mt-4 text-sm text-muted-foreground">Enriching plan…</p>
			)}

			{playbook && (
				<Card className="mt-6 p-6">
					<CardContent className="p-0">
						<div className="flex items-center justify-between">
							<div>
								<div className="eyebrow">Proposed plan</div>
								<p className="mt-1 text-sm text-muted-foreground">
									{playbook.summary}
								</p>
							</div>
							<div className="flex gap-2">
								<Button variant="outline" onClick={copyMarkdown}>
									Copy Markdown
								</Button>
								<Button onClick={save} disabled={playbook.actions.length === 0}>
									Save plan
								</Button>
							</div>
						</div>
						<ol className="mt-4 space-y-2">
							{playbook.actions.map((a, i) => (
								<li
									key={a.knowledgeId}
									className="border-t border-border pt-2 text-sm"
								>
									<div className="flex items-center gap-3">
										<span className="numerals text-muted-foreground">
											{i + 1}
										</span>
										<span className="text-foreground">{a.action}</span>
										<span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
											{a.criticality && (
												<Badge
													variant={
														a.criticality === "high"
															? "destructive"
															: "secondary"
													}
												>
													{a.criticality}
												</Badge>
											)}
											<span>bus {a.busFactor}</span>
											{a.targetDate && (
												<span className="numerals">{a.targetDate}</span>
											)}
										</span>
									</div>
									{(a.detailedSteps?.length || a.rationale || a.riskNote) && (
										<div className="mt-2 space-y-1 pl-8 text-xs text-muted-foreground">
											{a.suggestedTrainerName && (
												<p>Suggested trainer: {a.suggestedTrainerName}</p>
											)}
											{a.rationale && <p>Rationale: {a.rationale}</p>}
											{a.riskNote && <p>Risk: {a.riskNote}</p>}
											{a.detailedSteps?.length ? (
												<ul className="list-disc pl-4">
													{a.detailedSteps.map((step) => (
														<li key={step}>{step}</li>
													))}
												</ul>
											) : null}
										</div>
									)}
								</li>
							))}
							{playbook.actions.length === 0 && (
								<li className="pt-2 text-sm text-muted-foreground">
									This person holds no mapped knowledge.
								</li>
							)}
						</ol>
					</CardContent>
				</Card>
			)}

			<div className="mt-8">
				<div className="mb-3 flex items-center justify-between">
					<div className="eyebrow">Saved missions ({missions.length})</div>
					{missions.length > 0 && (
						<Button variant="outline" size="sm" onClick={copyMarkdown}>
							Export Markdown
						</Button>
					)}
				</div>
				{missions.length > 0 && (
					<Card className="divide-y divide-border p-0">
						{missions.map((m) => (
							<div key={m.id} className="px-5 py-3 text-sm">
								<div className="flex items-center gap-3">
									<Badge variant="secondary">{m.status}</Badge>
									<span className="text-foreground">{m.objective}</span>
									<span className="ml-auto flex items-center gap-2">
										{m.dueDate && (
											<span className="numerals text-xs text-muted-foreground">
												{m.dueDate}
											</span>
										)}
										{allowed &&
											VALID_TRANSITIONS[m.status].map((to) => (
												<button
													key={to}
													onClick={() => transition(m.id, to)}
													className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-foreground hover:text-foreground"
												>
													→ {to}
												</button>
											))}
									</span>
								</div>
								{(m.detailedSteps?.length || m.rationale || m.riskNote) && (
									<div className="mt-2 space-y-1 pl-20 text-xs text-muted-foreground">
										{m.suggestedTrainerName && (
											<p>Suggested trainer: {m.suggestedTrainerName}</p>
										)}
										{m.rationale && <p>Rationale: {m.rationale}</p>}
										{m.riskNote && <p>Risk: {m.riskNote}</p>}
										{m.detailedSteps?.length ? (
											<ul className="list-disc pl-4">
												{m.detailedSteps.map((step) => (
													<li key={step}>{step}</li>
												))}
											</ul>
										) : null}
									</div>
								)}
							</div>
						))}
					</Card>
				)}
			</div>
		</div>
	);
}
