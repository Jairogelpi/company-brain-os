"use client";

import { computeAllMetrics } from "@/domain/metrics";
import { detectAllRisks } from "@/domain/risk-engine";
import { createMissionsFromReport, type Mission } from "@/domain/missions";
import type { GraphService } from "@/domain/graph-service";
import { useState, useMemo, useCallback } from "react";

export type InsightsPanelProps = {
	service: GraphService;
};

export default function InsightsPanel({ service }: InsightsPanelProps) {
	const [missions, setMissions] = useState<Mission[]>([]);

	const nodes = useMemo(() => service.listNodes(), [service.eventLog().length]);
	const edges = useMemo(() => service.listEdges(), [service.eventLog().length]);

	const metrics = useMemo(
		() => computeAllMetrics(nodes, edges),
		[nodes, edges],
	);
	const riskReport = useMemo(
		() => detectAllRisks(nodes, edges),
		[nodes, edges],
	);

	const handleGenerateMissions = useCallback(() => {
		const generated = createMissionsFromReport(
			riskReport.risks,
			"dashboard",
			5,
		);
		setMissions(generated);
	}, [riskReport.risks]);

	return (
		<div className="space-y-4 p-4">
			{/* Metrics summary */}
			<div className="grid grid-cols-4 gap-3">
				<div className="rounded-lg border bg-white p-3">
					<div className="text-xs text-slate-500">Coverage</div>
					<div className="mt-1 text-xl font-semibold text-slate-950">
						{metrics.coverage.coveragePercent}%
					</div>
					<div className="text-xs text-slate-400">
						{metrics.coverage.coveredCritical}/{metrics.coverage.totalCritical}{" "}
						critical
					</div>
				</div>
				<div className="rounded-lg border bg-white p-3">
					<div className="text-xs text-slate-500">Health</div>
					<div className="mt-1 text-xl font-semibold text-slate-950">
						{metrics.health.overallScore}
					</div>
					<div className="text-xs text-slate-400">/ 100</div>
				</div>
				<div className="rounded-lg border bg-white p-3">
					<div className="text-xs text-slate-500">Company IQ</div>
					<div className="mt-1 text-xl font-semibold text-slate-950">
						{metrics.companyIQ.iq}
					</div>
					<div className="text-xs text-slate-400">
						{metrics.companyIQ.documentedAndValidated}/
						{metrics.companyIQ.totalKnowledge} valid
					</div>
				</div>
				<div className="rounded-lg border bg-red-50 p-3">
					<div className="text-xs text-red-600">Risks</div>
					<div className="mt-1 text-xl font-semibold text-red-700">
						{riskReport.summary.total}
					</div>
					<div className="text-xs text-red-500">
						{riskReport.summary.critical} critical · {riskReport.summary.high}{" "}
						high
					</div>
				</div>
			</div>

			{/* Risk list */}
			{riskReport.risks.length > 0 && (
				<div className="rounded-lg border bg-white">
					<div className="border-b px-4 py-2">
						<div className="flex items-center justify-between">
							<span className="text-sm font-semibold text-slate-800">
								Detected Risks
							</span>
							<button
								onClick={handleGenerateMissions}
								className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
							>
								Generate Missions
							</button>
						</div>
					</div>
					<div className="divide-y max-h-48 overflow-y-auto">
						{riskReport.risks.map((risk) => (
							<div key={risk.id} className="px-4 py-2 text-sm">
								<div className="flex items-start gap-2">
									<span
										className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
											risk.severity === "critical"
												? "bg-red-100 text-red-800"
												: risk.severity === "high"
													? "bg-orange-100 text-orange-800"
													: "bg-yellow-100 text-yellow-800"
										}`}
									>
										{risk.severity}
									</span>
									<div>
										<p className="text-slate-700">{risk.message}</p>
										<p className="text-xs text-slate-400">
											{risk.riskType} · confidence {risk.confidence}%
										</p>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Generated missions */}
			{missions.length > 0 && (
				<div className="rounded-lg border bg-green-50">
					<div className="border-b px-4 py-2">
						<span className="text-sm font-semibold text-green-800">
							Generated Missions ({missions.length})
						</span>
					</div>
					<div className="divide-y max-h-48 overflow-y-auto">
						{missions.map((mission) => (
							<div key={mission.id} className="px-4 py-2 text-sm">
								<div className="flex items-start gap-2">
									<span
										className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
											mission.priority === "critical"
												? "bg-red-100 text-red-800"
												: "bg-orange-100 text-orange-800"
										}`}
									>
										{mission.status}
									</span>
									<div>
										<p className="text-slate-700">{mission.objective}</p>
										<p className="text-xs text-slate-400">
											{mission.assigneeIds.join(", ")} · {mission.priority}
										</p>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Bus factors detail */}
			{metrics.busFactors.length > 0 && (
				<div className="rounded-lg border bg-white">
					<div className="border-b px-4 py-2">
						<span className="text-sm font-semibold text-slate-800">
							Bus Factors
						</span>
					</div>
					<div className="divide-y max-h-48 overflow-y-auto">
						{metrics.busFactors
							.filter((bf) => bf.criticality === "high")
							.map((bf) => (
								<div key={bf.knowledgeId} className="px-4 py-2 text-sm">
									<div className="flex items-center justify-between">
										<span className="text-slate-700">{bf.knowledgeName}</span>
										<span
											className={`rounded px-2 py-0.5 text-xs font-medium ${
												bf.busFactor === 0
													? "bg-red-100 text-red-800"
													: bf.busFactor === 1
														? "bg-orange-100 text-orange-800"
														: "bg-green-100 text-green-800"
											}`}
										>
											BF {bf.busFactor}
										</span>
									</div>
								</div>
							))}
					</div>
				</div>
			)}
		</div>
	);
}
