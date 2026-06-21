"use client";

import { useState, useCallback, useMemo } from "react";
import {
	runConsultant,
	type ConsultantReport,
	type ConsultantRecommendation,
} from "@/ai/consultant";
import type { GraphService } from "@/domain/graph-service";

type Props = {
	service: GraphService;
};

export default function AIConsultantPanel({ service }: Props) {
	const [report, setReport] = useState<ConsultantReport | null>(null);
	const [loading, setLoading] = useState(false);

	const handleRun = useCallback(async () => {
		setLoading(true);
		try {
			const nodes = service.listNodes();
			const edges = service.listEdges();
			const result = await runConsultant(nodes, edges);
			setReport(result);
		} catch {
			setReport(null);
		} finally {
			setLoading(false);
		}
	}, [service]);

	const priorityColor = (p: string) =>
		p === "critical"
			? "bg-red-100 text-red-800"
			: p === "high"
				? "bg-orange-100 text-orange-800"
				: p === "medium"
					? "bg-yellow-100 text-yellow-800"
					: "bg-slate-100 text-slate-600";

	const typeIcon = (t: string) => {
		const map: Record<string, string> = {
			document: "📄",
			train: "🎓",
			hire: "👥",
			validate: "✅",
			monitor: "📊",
		};
		return map[t] ?? "📌";
	};

	return (
		<div className="space-y-4 p-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-sm font-semibold text-slate-800">
						AI Consultant
					</h3>
					<p className="text-xs text-slate-500">
						Analyzes the graph and recommends actions
					</p>
				</div>
				<button
					onClick={handleRun}
					disabled={loading}
					className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
				>
					{loading ? "Analyzing..." : report ? "Re-run" : "Run Consultant"}
				</button>
			</div>

			{report && (
				<>
					{/* Summary */}
					<div className="rounded-lg border bg-blue-50 p-4">
						<p className="text-sm text-blue-900">{report.summary}</p>
						<p className="mt-1 text-xs text-blue-500">
							Generated at {new Date(report.generatedAt).toLocaleTimeString()} ·{" "}
							{report.modelUsed}
						</p>
					</div>

					{/* Recommendations */}
					<div className="grid gap-2">
						{report.recommendations.map((rec) => (
							<div
								key={rec.id}
								className="rounded-lg border bg-white p-3 transition hover:shadow-sm"
							>
								<div className="flex items-start gap-3">
									<span className="mt-0.5 text-lg">{typeIcon(rec.type)}</span>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span
												className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${priorityColor(rec.priority)}`}
											>
												{rec.priority}
											</span>
											<span className="text-xs text-slate-400 uppercase">
												{rec.type}
											</span>
										</div>
										<p className="mt-1 text-sm font-medium text-slate-800">
											{rec.message}
										</p>
										<p className="mt-1 text-xs text-slate-500">
											{rec.rationale}
										</p>
										<p className="mt-1 text-xs text-green-700">
											💡 {rec.roiHint}
										</p>
									</div>
								</div>
							</div>
						))}
					</div>

					{report.recommendations.length === 0 && (
						<p className="text-sm text-slate-400 italic">
							No recommendations — the organization looks healthy!
						</p>
					)}
				</>
			)}
		</div>
	);
}
