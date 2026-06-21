"use client";

import { useState, useCallback } from "react";
import type {
	InterviewSession,
	InterviewAlarm,
	GraphOperationProposal,
} from "@/domain/interview";
import {
	createInterviewSession,
	answerInterviewQuestion,
} from "@/domain/interview";
import type { GraphConfirmationDecision } from "@/domain/graph-confirmation";
import type { GraphService, GraphServiceEvent } from "@/domain/graph-service";

export type InterviewChatProps = {
	service: GraphService;
	onProposalsApplied?: () => void;
};

export default function InterviewChat({
	service,
	onProposalsApplied,
}: InterviewChatProps) {
	const [session, setSession] = useState<InterviewSession>(() =>
		createInterviewSession(),
	);
	const [input, setInput] = useState("");
	const [history, setHistory] = useState<string[]>([]);

	const submitAnswer = useCallback(() => {
		const text = input.trim();
		if (!text) return;

		const next = answerInterviewQuestion(session, text);
		setSession(next);
		setHistory((prev) => [...prev, text]);
		setInput("");
	}, [session, input]);

	const confirmAll = useCallback(() => {
		if (session.proposals.length === 0) return;

		const decisions: GraphConfirmationDecision[] = session.proposals.map(
			(_, i) => ({
				proposalIndex: i,
				decision: "approve" as const,
			}),
		);

		service.applyProposalsWithDecisions(session.proposals, decisions);
		onProposalsApplied?.();
	}, [session.proposals, service, onProposalsApplied]);

	const events = service.eventLog().slice(-10);

	return (
		<div className="flex h-full flex-col rounded-xl border bg-white shadow-sm">
			{/* Header */}
			<div className="border-b px-4 py-3">
				<h2 className="text-sm font-semibold text-slate-800">
					Adaptive Interview
				</h2>
				<p className="text-xs text-slate-500">
					{session.askedQuestions.length} questions asked
				</p>
			</div>

			{/* Current question */}
			<div className="border-b bg-slate-50 px-4 py-3">
				<div className="text-xs font-medium uppercase tracking-wide text-slate-400">
					{session.currentQuestion.probe}
				</div>
				<p className="mt-1 text-sm font-medium text-slate-800">
					{session.currentQuestion.text}
				</p>
			</div>

			{/* Facts collected */}
			<div className="px-4 py-2">
				<div className="text-xs font-medium text-slate-500">Facts</div>
				<div className="mt-1 flex flex-wrap gap-1 text-xs">
					{session.facts.keyPerson && (
						<span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800">
							{session.facts.keyPerson.name}
						</span>
					)}
					{session.facts.knowledge && (
						<span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-800">
							{session.facts.knowledge.name}
						</span>
					)}
					{session.facts.substitute && (
						<span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-800">
							{session.facts.substitute.name} (L{session.facts.substitute.level}
							)
						</span>
					)}
					{session.facts.process && (
						<span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">
							{session.facts.process.name}
						</span>
					)}
					{session.facts.rules.map((rule) => (
						<span
							key={rule.id}
							className="rounded-full bg-red-100 px-2 py-0.5 text-red-800"
						>
							{rule.name}
						</span>
					))}
					{session.facts.documented !== undefined && (
						<span
							className={`rounded-full px-2 py-0.5 ${
								session.facts.documented
									? "bg-green-100 text-green-800"
									: "bg-red-100 text-red-800"
							}`}
						>
							{session.facts.documented ? "Documented" : "Undocumented"}
						</span>
					)}
				</div>
			</div>

			{/* Pending proposals */}
			{session.proposals.length > 0 && (
				<div className="border-t px-4 py-2">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-500">
							{session.proposals.length} proposals pending
						</span>
						<button
							onClick={confirmAll}
							className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
						>
							Confirm All
						</button>
					</div>
				</div>
			)}

			{/* Alarms */}
			{session.alarms.length > 0 && (
				<div className="border-t bg-red-50 px-4 py-3">
					<div className="text-xs font-semibold uppercase tracking-wide text-red-700">
						First Alarm
					</div>
					{session.alarms.map((alarm) => (
						<p key={alarm.id} className="mt-1 text-sm font-medium text-red-900">
							{alarm.message}
						</p>
					))}
				</div>
			)}

			{/* Event log (last 10) */}
			<div className="flex-1 overflow-y-auto border-t px-4 py-2">
				<div className="text-xs font-medium text-slate-500">Event Log</div>
				<div className="mt-1 space-y-1">
					{events.length === 0 && (
						<p className="text-xs text-slate-400">No events yet.</p>
					)}
					{events.map((event) => (
						<div
							key={event.id}
							className="flex items-start gap-2 text-xs text-slate-600"
						>
							<span className="mt-0.5 shrink-0 rounded bg-slate-200 px-1 py-0.5 font-mono text-[10px]">
								{event.eventType.replace("graph.", "")}
							</span>
							<span className="text-slate-400">
								{new Date(event.createdAt).toLocaleTimeString()}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Input */}
			<div className="border-t p-3">
				<div className="flex gap-2">
					<input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") submitAnswer();
						}}
						placeholder="Type your answer..."
						className="flex-1 rounded-lg border px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
					/>
					<button
						onClick={submitAnswer}
						className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
					>
						Send
					</button>
				</div>
			</div>
		</div>
	);
}
