"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { createGraphService } from "@/domain/graph-service";
import {
	answerInterviewQuestion,
	createInterviewSession,
} from "@/domain/interview";
import { OrganizationMemory } from "@/ai/organization-memory";
import { Search } from "lucide-react";

function seedService() {
	const session = [
		"Pedro es indispensable; si falta mañana se para producción.",
		"Solo Pedro configura la llenadora crítica y nadie más sabe hacerlo.",
		"Laura lo vio una vez, nivel 2; no hay sustituto real.",
		"No está escrito en ningún sitio.",
	].reduce((s, a) => answerInterviewQuestion(s, a), createInterviewSession());

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

export default function GlobalSearch() {
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);

	const service = useMemo(() => seedService(), []);
	const memory = useMemo(() => {
		const mem = new OrganizationMemory();
		mem.index(service.listNodes(), service.listEdges());
		return mem;
	}, [service]);

	const results = useMemo(() => {
		if (query.trim().length < 2) return [];
		return memory.search(query, 5).filter((r) => r.score > 0.05);
	}, [query, memory]);

	return (
		<div className="relative">
			<div className="flex w-72 items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
				<Search className="h-4 w-4 text-muted-foreground" />
				<input
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					onBlur={() => setTimeout(() => setOpen(false), 200)}
					placeholder="Search people, skills, knowledge..."
					className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
				/>
			</div>

			{open && results.length > 0 && (
				<div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-popover">
					{results.map((r) => {
						const href =
							r.metadata.nodeType === "Person"
								? `/people/${r.id}`
								: r.metadata.nodeType === "Knowledge"
									? "/knowledge"
									: "/graph";

						return (
							<Link
								key={r.id}
								href={href}
								className="flex items-center justify-between px-3 py-2 text-sm hover:bg-secondary first:rounded-t-xl last:rounded-b-xl"
							>
								<div>
									<span className="text-foreground">
										{r.metadata.nodeName as string}
									</span>
									<span className="ml-2 text-xs text-muted-foreground">
										{r.metadata.nodeType as string}
									</span>
								</div>
								<span className="text-xs text-muted-foreground">
									{Math.round(r.score * 100)}%
								</span>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}
