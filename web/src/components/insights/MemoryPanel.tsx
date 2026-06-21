"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import {
	OrganizationMemory,
	type MemoryQueryResult,
} from "@/ai/organization-memory";
import type { GraphService } from "@/domain/graph-service";

type Props = {
	service: GraphService;
};

export default function MemoryPanel({ service }: Props) {
	const [query, setQuery] = useState("");
	const [result, setResult] = useState<MemoryQueryResult | null>(null);
	const [loading, setLoading] = useState(false);

	const memory = useMemo(() => new OrganizationMemory(), []);
	const isIndexed = useRef(false);

	const handleIndex = useCallback(() => {
		const nodes = service.listNodes();
		const edges = service.listEdges();
		memory.index(nodes, edges);
		isIndexed.current = true;
	}, [service, memory]);

	const handleSearch = useCallback(async () => {
		if (!query.trim()) return;
		if (!isIndexed.current) handleIndex();

		setLoading(true);
		try {
			const result = await memory.answer(query);
			setResult(result);
		} finally {
			setLoading(false);
		}
	}, [query, memory, handleIndex]);

	return (
		<div className="space-y-4 p-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-sm font-semibold text-slate-800">
						🧠 Org Memory
					</h3>
					<p className="text-xs text-slate-500">
						Semantic search over organizational knowledge
					</p>
				</div>
				<button
					onClick={handleIndex}
					className="rounded-lg border px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
				>
					{isIndexed.current ? "Re-index" : "Index Graph"}
				</button>
			</div>

			{/* Search bar */}
			<div className="flex gap-2">
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleSearch();
					}}
					placeholder='Preguntá: "¿Quién sabe configurar la llenadora?"'
					className="flex-1 rounded-lg border px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
				/>
				<button
					onClick={handleSearch}
					disabled={loading}
					className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
				>
					{loading ? "..." : "Ask"}
				</button>
			</div>

			{/* Result */}
			{result && (
				<div className="space-y-3">
					<div className="rounded-lg border bg-blue-50 p-4">
						<p className="text-sm text-blue-900 whitespace-pre-wrap">
							{result.answer}
						</p>
					</div>

					{result.sources.length > 0 && (
						<div>
							<div className="text-xs font-medium text-slate-500 mb-1">
								Sources
							</div>
							<div className="space-y-1">
								{result.sources.map((s) => (
									<div
										key={s.nodeId}
										className="flex items-center justify-between rounded border bg-white px-3 py-1.5 text-xs"
									>
										<div>
											<span className="font-medium text-slate-700">
												{s.nodeName}
											</span>
											<span className="ml-2 text-slate-400">{s.nodeType}</span>
										</div>
										<span className="text-slate-400">
											{Math.round(s.relevance * 100)}%
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
