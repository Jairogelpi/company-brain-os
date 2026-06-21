"use client";

import { useRef, useState, useCallback } from "react";
import { createGraphService } from "@/domain/graph-service";
import GraphCanvas from "@/canvas/GraphCanvas";
import InterviewChat from "@/components/interview/InterviewChat";

import InsightsPanel from "@/components/insights/InsightsPanel";
import AIConsultantPanel from "@/components/insights/AIConsultantPanel";
import MemoryPanel from "@/components/insights/MemoryPanel";

export default function DashboardPage() {
	const serviceRef = useRef(
		createGraphService({ actorId: "dashboard", companyId: "demo-corp" }),
	);
	const [syncVersion, setSyncVersion] = useState(0);

	const handleProposalsApplied = useCallback(() => {
		setSyncVersion((v) => v + 1);
	}, []);

	return (
		<main className="min-h-[100dvh] bg-slate-50">
			{/* Header */}
			<header className="border-b bg-white px-6 py-4 shadow-sm">
				<div className="mx-auto flex max-w-[1600px] items-center justify-between">
					<div>
						<h1 className="text-lg font-semibold text-slate-950">
							Company Brain OS — Dashboard
						</h1>
						<p className="text-sm text-slate-500">
							Interview → Graph → Metrics → Risks → Missions
						</p>
					</div>
					<a
						href="/"
						className="rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
					>
						← Home
					</a>
				</div>
			</header>

			{/* Main content: canvas (left) + interview chat (right) */}
			<div
				className="mx-auto flex max-w-[1600px] gap-0 p-4"
				style={{ minHeight: "calc(100vh - 73px - 300px)" }}
			>
				{/* Canvas panel */}
				<div className="flex-1 pr-2">
					<GraphCanvas service={serviceRef.current} syncVersion={syncVersion} />
				</div>

				{/* Chat panel */}
				<div className="w-[380px] shrink-0 pl-2">
					<InterviewChat
						service={serviceRef.current}
						onProposalsApplied={handleProposalsApplied}
					/>
				</div>
			</div>

			{/* Insights panel: metrics, risks, missions */}
			<div className="mx-auto max-w-[1600px] border-t bg-white px-4 py-2">
				<InsightsPanel service={serviceRef.current} />
			</div>

			{/* AI Consultant: recommendations */}
			<div className="mx-auto max-w-[1600px] border-t bg-white px-4 py-2">
				<AIConsultantPanel service={serviceRef.current} />
			</div>

			{/* Organization Memory: semantic search */}
			<div className="mx-auto max-w-[1600px] border-t bg-white px-4 py-2">
				<MemoryPanel service={serviceRef.current} />
			</div>
		</main>
	);
}
