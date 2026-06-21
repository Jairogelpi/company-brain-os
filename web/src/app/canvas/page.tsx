"use client";

import { useMemo } from "react";
import {
	answerInterviewQuestion,
	createInterviewSession,
} from "@/domain/interview";
import { createGraphService } from "@/domain/graph-service";
import GraphCanvas from "@/canvas/GraphCanvas";

// ponytail: seed the graph service with a demo interview session using all probes
function seedDemoService() {
	const session = [
		"Pedro es indispensable; si falta mañana se para producción.",
		"Solo Pedro configura la llenadora crítica y nadie más sabe hacerlo.",
		"Laura lo vio una vez, nivel 2; no hay sustituto real.",
		"No está escrito en ningún sitio.",
	].reduce(
		(s, answer) => answerInterviewQuestion(s, answer),
		createInterviewSession(),
	);

	const service = createGraphService({
		actorId: "demo",
		companyId: "demo-corp",
	});
	const allApproved = session.proposals.map((_, i) => ({
		proposalIndex: i,
		decision: "approve" as const,
	}));

	service.applyProposalsWithDecisions(session.proposals, allApproved);

	return service;
}

export default function CanvasPage() {
	const service = useMemo(() => seedDemoService(), []);

	return (
		<main className="min-h-[100dvh] px-6 py-10">
			<section className="mx-auto max-w-6xl space-y-6">
				<div className="space-y-2">
					<h1 className="text-3xl font-semibold tracking-tight text-slate-950">
						Graph Canvas
					</h1>
					<p className="text-slate-600">
						Demo canvas rendering the graph populated from the adaptive
						interview engine. Nodes are color-coded by type. Arrows represent
						domain relationships.
					</p>
					<div className="flex flex-wrap gap-2 text-sm text-slate-500">
						{[
							{ label: "Person", color: "blue" },
							{ label: "Knowledge", color: "orange" },
							{ label: "Process", color: "green" },
							{ label: "Asset", color: "violet" },
							{ label: "Unit", color: "grey" },
							{ label: "Risk", color: "red" },
						].map(({ label, color }) => (
							<span
								key={label}
								className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
							>
								<span
									className="inline-block h-2.5 w-2.5 rounded-full"
									style={{ backgroundColor: color }}
								/>
								{label}
							</span>
						))}
					</div>
				</div>

				<GraphCanvas service={service} />

				<div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
					F2 Canvas demo — in-memory GraphService, no persistence. Edits on the
					canvas write back to the service.{" "}
					<a href="/" className="underline">
						Back to home
					</a>
				</div>
			</section>
		</main>
	);
}
