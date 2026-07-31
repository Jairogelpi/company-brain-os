"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import type { GraphOperationProposal } from "@/domain/interview";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type PendingItem = {
	id: string;
	source: string;
	kind: "csv" | "text";
	proposal: GraphOperationProposal;
};

export default function InboxPage() {
	const { can } = useAuth();
	const allowed = can("graph.node.create");

	const [items, setItems] = useState<PendingItem[]>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState("");
	const [err, setErr] = useState("");

	const load = useCallback(async () => {
		const res = await fetch("/api/inbox");
		if (!res.ok) return setErr("Failed to load inbox.");
		const data = await res.json();
		setItems(data.items);
		setSelected(new Set(data.items.map((i: PendingItem) => i.id)));
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const nameById = useMemo(() => {
		const m = new Map<string, string>();
		for (const it of items) {
			if (it.proposal.type === "create_node")
				m.set(it.proposal.node.id, it.proposal.node.name);
		}
		return m;
	}, [items]);

	const ingest = async (payload: Record<string, unknown>) => {
		setErr("");
		setMsg("");
		setBusy(true);
		const res = await fetch("/api/ingest", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		setBusy(false);
		if (!res.ok) {
			const b = await res.json().catch(() => ({}));
			return setErr(b.error ?? "Ingest failed.");
		}
		const b = await res.json();
		if (b.items.length === 0) setMsg("Nothing new found.");
		await load();
	};

	const onFile = async (file: File) => {
		const content = await file.text();
		const isCsv = /\.csv$/i.test(file.name);
		await ingest(
			isCsv
				? { source: file.name, csv: content }
				: { source: file.name, text: content },
		);
	};

	const review = async (action: "approve" | "reject") => {
		const ids = [...selected];
		if (ids.length === 0) return;
		setBusy(true);
		setErr("");
		const res = await fetch("/api/inbox", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action, ids }),
		});
		setBusy(false);
		if (!res.ok) {
			const b = await res.json().catch(() => ({}));
			return setErr(b.error ?? "Review failed.");
		}
		const b = await res.json();
		setMsg(
			action === "approve"
				? `Approved — ${b.applied} graph operation(s) written.`
				: `Rejected ${b.rejected} item(s).`,
		);
		await load();
	};

	const toggle = (id: string) =>
		setSelected((s) => {
			const n = new Set(s);
			n.has(id) ? n.delete(id) : n.add(id);
			return n;
		});

	const describe = (p: GraphOperationProposal): string => {
		if (p.type === "create_node") return `Add ${p.node.type} "${p.node.name}"`;
		if (p.type === "create_edge")
			return `Link ${nameById.get(p.edge.fromNodeId) ?? p.edge.fromNodeId} → ${
				nameById.get(p.edge.toNodeId) ?? p.edge.toNodeId
			} (${p.edge.type})`;
		return `Update ${p.nodeId}`;
	};

	return (
		<div className="px-8 py-10 rise">
			<div className="border-b border-border pb-6">
				<div className="eyebrow">Zero-effort capture</div>
				<h1 className="text-[44px] font-semibold tracking-[-0.045em]">
					Review inbox
				</h1>
				<p className="mt-2 max-w-xl text-sm text-muted-foreground">
					Feed existing data — an employee CSV or a meeting transcript — and
					approve the draft map. Nothing is written until you approve.
				</p>
			</div>

			<div className="mt-8 grid gap-4 lg:grid-cols-2">
				<Card className="flex flex-col gap-3 p-5">
					<CardContent className="p-0">
						<div className="eyebrow">Upload a file</div>
						<label
							className={`mt-2 inline-flex cursor-pointer self-start rounded-xl px-4 py-2.5 text-sm font-medium ${
								allowed
									? "bg-foreground text-background hover:opacity-90"
									: "cursor-not-allowed bg-secondary text-muted-foreground"
							}`}
						>
							Choose CSV / TXT / MD
							<input
								type="file"
								accept=".csv,.txt,.md,text/csv,text/plain,text/markdown"
								disabled={!allowed || busy}
								className="hidden"
								onChange={(e) => {
									const f = e.target.files?.[0];
									if (f) onFile(f);
									e.target.value = "";
								}}
							/>
						</label>
						<span className="eyebrow mt-2 block">
							CSV columns: name, role, team, manager
						</span>
					</CardContent>
				</Card>

				<Card className="flex flex-col gap-3 p-5">
					<CardContent className="p-0">
						<div className="eyebrow">Paste a transcript / notes</div>
						<Textarea
							value={text}
							onChange={(e) => setText(e.target.value)}
							placeholder="Pedro es indispensable; solo él configura la llenadora crítica…"
							rows={3}
							disabled={!allowed}
							className="mt-2"
						/>
						<Button
							onClick={() => {
								if (text.trim())
									ingest({ source: "pasted text", text }).then(() =>
										setText(""),
									);
							}}
							disabled={!allowed || busy || !text.trim()}
							className="mt-2 self-start"
						>
							Extract from text
						</Button>
					</CardContent>
				</Card>
			</div>

			{err && (
				<p className="mt-4 text-sm font-medium text-destructive">{err}</p>
			)}
			{msg && (
				<Card className="mt-4 p-4">
					<CardContent className="p-0">
						<p className="text-sm text-foreground">{msg}</p>
						<Link
							href="/people"
							className="mt-2 inline-block text-xs font-medium text-foreground hover:underline"
						>
							View People →
						</Link>
					</CardContent>
				</Card>
			)}

			<div className="mt-8">
				<div className="mb-3 flex items-center justify-between">
					<div className="eyebrow">
						{items.length === 0
							? "No pending items"
							: `${selected.size} of ${items.length} selected`}
					</div>
					{items.length > 0 && (
						<div className="flex gap-2">
							<Button
								variant="outline"
								onClick={() => review("reject")}
								disabled={busy || !allowed || selected.size === 0}
							>
								Reject
							</Button>
							<Button
								onClick={() => review("approve")}
								disabled={busy || !allowed || selected.size === 0}
							>
								{busy ? "Working…" : "Approve selected"}
							</Button>
						</div>
					)}
				</div>

				{items.length > 0 && (
					<Card className="divide-y divide-border p-0">
						{items.map((it) => (
							<label
								key={it.id}
								className="flex cursor-pointer items-center gap-3 px-5 py-3 text-sm"
							>
								<input
									type="checkbox"
									checked={selected.has(it.id)}
									onChange={() => toggle(it.id)}
									disabled={!allowed}
								/>
								<span className="text-foreground">{describe(it.proposal)}</span>
								<span className="eyebrow ml-auto">{it.source}</span>
							</label>
						))}
					</Card>
				)}
			</div>

			{!allowed && (
				<p className="mt-6 text-sm text-muted-foreground">
					Your role is read-only — ask a contributor or owner to approve.
				</p>
			)}
		</div>
	);
}
