"use client";

import { Search } from "lucide-react";

/**
 * Search intentionally does not fabricate an in-memory demo graph. It becomes
 * data-backed in the search release; until then it communicates that state.
 */
export default function GlobalSearch() {
	return (
		<div className="flex w-72 items-center gap-2 rounded-xl border border-border px-3 py-1.5" style={{ background: "var(--search-bg, var(--color-background))" }}>
			<Search className="h-4 w-4 text-muted-foreground" />
			<span className="text-sm text-muted-foreground">Search is available when organization data is loaded.</span>
		</div>
	);
}
