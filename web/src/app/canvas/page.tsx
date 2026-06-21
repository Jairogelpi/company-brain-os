"use client";

import { useMemo } from "react";
import {
	answerInterviewQuestion,
	createInterviewSession,
} from "@/domain/interview";
import { createGraphService } from "@/domain/graph-service";
import GraphCanvas from "@/canvas/GraphCanvas";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TYPE_DOT: Record<string, string> = {
	Person: "bg-foreground",
	Knowledge: "bg-muted-foreground",
	Process: "bg-foreground",
	Asset: "bg-muted-foreground",
	Unit: "bg-muted",
	Risk: "bg-destructive",
};

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
		<main className="min-h-[100dvh] bg-background px-6 py-10 text-foreground">
			<section className="mx-auto max-w-6xl space-y-6">
				<div className="space-y-2">
					<h1 className="text-3xl font-medium tracking-tight">Graph Canvas</h1>
					<p className="text-sm text-muted-foreground">
						Demo canvas rendering the graph populated from the adaptive interview
						engine. Nodes are color-coded by type. Arrows represent domain
						relationships.
					</p>
					<div className="flex flex-wrap gap-2 text-sm">
						{[
							{ label: "Person", type: "Person" },
							{ label: "Knowledge", type: "Knowledge" },
							{ label: "Process", type: "Process" },
							{ label: "Asset", type: "Asset" },
							{ label: "Unit", type: "Unit" },
							{ label: "Risk", type: "Risk" },
						].map(({ label, type }) => (
							<Badge key={label} variant="secondary" className="gap-1.5">
								<span
									className={`inline-block h-2.5 w-2.5 rounded-full ${TYPE_DOT[type] ?? "bg-muted-foreground"}`}
								/>
								{label}
							</Badge>
						))}
					</div>
				</div>

				<Card className="overflow-hidden p-0">
					<GraphCanvas service={service} />
				</Card>

				<div className="rounded-lg border border-border bg-secondary p-4 text-sm text-muted-foreground">
					F2 Canvas demo — in-memory GraphService, no persistence. Edits on the
					canvas write back to the service.{" "}
					<a href="/" className="text-foreground underline">
						Back to home
					</a>
				</div>
			</section>
		</main>
	);
}
