"use client";

import { useEffect, useState } from "react";
import type { GraphEdge, GraphNode } from "@/domain/graph";

export type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] };

/** Loads the current company's graph from the DB-backed API. */
export function useGraph() {
	const [data, setData] = useState<GraphData | null>(null);
	const [error, setError] = useState("");

	const reload = async () => {
		setError("");
		const res = await fetch("/api/graph");
		if (!res.ok) return setError("Failed to load graph.");
		setData((await res.json()) as GraphData);
	};

	useEffect(() => {
		reload();
	}, []);

	return { data, error, reload };
}
