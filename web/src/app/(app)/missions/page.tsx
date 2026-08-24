"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type {
	Mission,
	MissionSubmission,
	TransferVerification,
} from "@/domain/missions";

type CompanyUser = { id: string; name: string; email: string; role: string; personNodeId?: string };
type CompanyPerson = { id: string; name: string; source: "graph"; mappedUserId?: string };

const STATUS_VARIANT: Record<
	string,
	"default" | "secondary" | "destructive" | "outline"
> = {
	open: "outline",
	in_progress: "secondary",
	submitted: "default",
	validated: "default",
	closed: "secondary",
};

function StatusBadge({ status }: { status: string }) {
	return (
		<Badge variant={STATUS_VARIANT[status] ?? "outline"}>
			{status.replace("_", " ")}
		</Badge>
	);
}

export default function MissionsPage() {
	const { user, can } = useAuth();
	const canManage = can("mission.assign");

	const [missions, setMissions] = useState<Mission[]>([]);
	const [submissions, setSubmissions] = useState<MissionSubmission[]>([]);
	const [transferVerifications, setTransferVerifications] = useState<TransferVerification[]>([]);
	const [users, setUsers] = useState<CompanyUser[]>([]);
	const [people, setPeople] = useState<CompanyPerson[]>([]);
	const [error, setError] = useState("");
	const [loaded, setLoaded] = useState(false);

	const reload = useCallback(async () => {
		const res = await fetch("/api/missions");
		if (!res.ok) {
			setError("Failed to load missions.");
			return;
		}
		const data = (await res.json()) as {
			items: Mission[];
			submissions: MissionSubmission[];
			transferVerifications: TransferVerification[];
		};
		setMissions(data.items);
		setSubmissions(data.submissions ?? []);
		setTransferVerifications(data.transferVerifications ?? []);
		setLoaded(true);
	}, []);

	useEffect(() => {
		reload();
		fetch("/api/people")
			.then((response) => response.ok ? response.json() : { people: [] })
			.then((data) => setPeople(data.people ?? []))
			.catch(() => {});
		if (canManage) {
			fetch("/api/users")
				.then((r) => (r.ok ? r.json() : { users: [] }))
				.then((d) => setUsers(d.users ?? []))
				.catch(() => {});
		}
	}, [reload, canManage]);

	const userName = useMemo(() => {
		const m = new Map(users.map((u) => [u.id, u.name]));
		return (id?: string) => (id ? (m.get(id) ?? id) : "—");
	}, [users]);

	const latestSubmission = useCallback(
		(missionId: string) =>
			submissions
				.filter((s) => s.missionId === missionId)
				.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
		[submissions],
	);
	const latestVerification = useCallback(
		(missionId: string) => transferVerifications
			.filter((item) => item.missionId === missionId)
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
		[transferVerifications],
	);

	const myTasks = useMemo(
		() => missions.filter((m) => m.assigneeId === user?.id),
		[missions, user?.id],
	);

	if (!loaded) {
		return (
			<div className="p-10 text-sm text-muted-foreground">
				{error || "Loading…"}
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl space-y-10 p-8">
			<header>
				<div className="eyebrow">Knowledge transfer</div>
				<h1 className="text-[44px] font-semibold tracking-[-0.045em]">Missions</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Document, assess a real backup, verify access, then recalculate the risk.
				</p>
			</header>

			{/* Employee: my assigned tasks */}
			<section className="space-y-4">
				<h2 className="text-sm font-medium">
					My tasks{" "}
					<span className="text-muted-foreground">({myTasks.length})</span>
				</h2>
				{myTasks.length === 0 && (
					<p className="text-sm text-muted-foreground">Nothing assigned to you.</p>
				)}
				{myTasks.map((m) => (
					<MyTaskCard
						key={m.id}
						mission={m}
						submission={latestSubmission(m.id)}
						onChanged={reload}
					/>
				))}
			</section>

			{/* Boss: assign + review everything */}
			{canManage && (
				<section className="space-y-4">
					<h2 className="text-sm font-medium">
						Manage all missions{" "}
						<span className="text-muted-foreground">({missions.length})</span>
					</h2>
					{missions.map((m) => (
						<ManageCard
							key={m.id}
							mission={m}
							submission={latestSubmission(m.id)}
							verification={latestVerification(m.id)}
							users={users}
							people={people}
							userName={userName}
							currentUserId={user?.id ?? ""}
							onChanged={reload}
						/>
					))}
				</section>
			)}
		</div>
	);
}

// --- Employee task card ---

function MyTaskCard({
	mission,
	submission,
	onChanged,
}: {
	mission: Mission;
	submission?: MissionSubmission;
	onChanged: () => void;
}) {
	const canSubmit = ["open", "in_progress"].includes(mission.status);
	return (
		<Card id={mission.id} className="scroll-mt-20 space-y-3 p-5">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="font-medium">{mission.objective}</div>
					<div className="text-xs text-muted-foreground">
						{mission.targetNodeName} · priority {mission.priority}
						{mission.dueDate ? ` · due ${mission.dueDate.slice(0, 10)}` : ""}
					</div>
				</div>
				<StatusBadge status={mission.status} />
			</div>

			{mission.instructions && (
				<div className="rounded-md bg-muted p-3 text-sm">
					<div className="eyebrow mb-1">Instructions</div>
					{mission.instructions}
				</div>
			)}

			{mission.rejectionReason && (
				<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
					<div className="eyebrow mb-1 text-destructive">
						Rejected — please revise
					</div>
					{mission.rejectionReason}
				</div>
			)}

			{mission.status === "submitted" && (
				<p className="text-sm text-muted-foreground">
					Submitted — waiting for review.
				</p>
			)}
			{mission.status === "closed" && (
				<p className="text-sm text-emerald-600">Transfer verified and risk recalculated. ✓</p>
			)}
			{mission.status === "validated" && (
				<p className="text-sm text-amber-700">
					Documentation approved — waiting for an independently verified backup.
				</p>
			)}

			{canSubmit && (
				<SubmitForm missionId={mission.id} onSubmitted={onChanged} />
			)}
		</Card>
	);
}

function SubmitForm({
	missionId,
	onSubmitted,
}: {
	missionId: string;
	onSubmitted: () => void;
}) {
	const [mode, setMode] = useState<"text" | "file">("text");
	const [text, setText] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");

	async function submit() {
		setBusy(true);
		setErr("");
		try {
			let payload: Record<string, unknown> = { missionId, kind: mode };
			if (mode === "file") {
				if (!file) {
					setErr("Choose a file.");
					return;
				}
				const fd = new FormData();
				fd.append("file", file);
				const up = await fetch("/api/upload", { method: "POST", body: fd });
				if (!up.ok) {
					const b = (await up.json().catch(() => ({}))) as { error?: string };
					setErr(b.error || "Upload failed.");
					return;
				}
				const u = (await up.json()) as {
					storageUrl: string;
					originalName: string;
					mimeType: string;
					mediaType: string;
				};
				payload = {
					...payload,
					storageUrl: u.storageUrl,
					fileName: u.originalName,
					mimeType: u.mimeType,
					mediaType: u.mediaType,
				};
			} else {
				payload.text = text;
			}
			const res = await fetch("/api/missions/submit", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (!res.ok) {
				const b = (await res.json().catch(() => ({}))) as { error?: string };
				setErr(b.error || "Submit failed.");
				return;
			}
			setText("");
			setFile(null);
			onSubmitted();
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="space-y-2 border-t border-border pt-3">
			<div className="flex gap-2">
				<Button
					size="sm"
					variant={mode === "text" ? "default" : "outline"}
					onClick={() => setMode("text")}
				>
					Write
				</Button>
				<Button
					size="sm"
					variant={mode === "file" ? "default" : "outline"}
					onClick={() => setMode("file")}
				>
					Upload file
				</Button>
			</div>

			{mode === "text" ? (
				<textarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					rows={4}
					placeholder="Document the process, steps, gotchas…"
					className="w-full resize-none rounded-md border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
				/>
			) : (
				<div className="space-y-1">
					<input
						type="file"
						accept=".pdf,.doc,.docx,.xls,.xlsx,.mp3,.wav,.ogg,.mp4,.webm,.png,.jpg,.jpeg,.txt,.md"
						onChange={(e) => setFile(e.target.files?.[0] ?? null)}
						className="block w-full text-sm"
					/>
					<p className="text-[11px] text-muted-foreground">
						PDF, Word, Excel, audio, video or image.
					</p>
				</div>
			)}

			{err && <p className="text-xs font-medium text-destructive">{err}</p>}
			<Button
				size="sm"
				onClick={submit}
				disabled={busy || (mode === "text" ? !text.trim() : !file)}
			>
				{busy ? "Submitting…" : "Submit for review"}
			</Button>
		</div>
	);
}

// --- Boss management card ---

function ManageCard({
	mission,
	submission,
	verification,
	users,
	people,
	userName,
	currentUserId,
	onChanged,
}: {
	mission: Mission;
	submission?: MissionSubmission;
	verification?: TransferVerification;
	users: CompanyUser[];
	people: CompanyPerson[];
	userName: (id?: string) => string;
	currentUserId: string;
	onChanged: () => void;
}) {
	const [assignee, setAssignee] = useState(mission.assigneeId ?? "");
	const [instructions, setInstructions] = useState(mission.instructions ?? "");
	const [reason, setReason] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");

	async function call(input: RequestInfo, init: RequestInit) {
		setBusy(true);
		setErr("");
		try {
			const res = await fetch(input, init);
			if (!res.ok) {
				const b = (await res.json().catch(() => ({}))) as { error?: string };
				setErr(b.error || `Failed (${res.status}).`);
				return false;
			}
			return true;
		} finally {
			setBusy(false);
		}
	}

	async function saveAssignment() {
		if (
			await call("/api/missions", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: mission.id, assigneeId: assignee, instructions }),
			})
		)
			onChanged();
	}

	async function review(decision: "approve" | "reject") {
		if (!submission) return;
		if (
			await call("/api/missions/review", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					submissionId: submission.id,
					decision,
					rejectionReason: decision === "reject" ? reason : undefined,
				}),
			})
		) {
			setReason("");
			onChanged();
		}
	}

	return (
		<Card className="space-y-3 p-5">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="font-medium">{mission.objective}</div>
					<div className="text-xs text-muted-foreground">
						{mission.targetNodeName} · assignee {userName(mission.assigneeId)}
					</div>
				</div>
				<StatusBadge status={mission.status} />
			</div>

			{/* Assign + instructions */}
			<div className="grid gap-2 sm:grid-cols-[200px_1fr]">
				<select
					className="h-9 rounded-md border border-border bg-background px-2 text-sm"
					value={assignee}
					onChange={(e) => setAssignee(e.target.value)}
				>
					<option value="">Assign to…</option>
					{users.map((u) => (
						<option key={u.id} value={u.id}>
							{u.name} ({u.role})
						</option>
					))}
				</select>
				<input
					value={instructions}
					onChange={(e) => setInstructions(e.target.value)}
					placeholder="Detailed instructions of what to do…"
					className="h-9 rounded-md border border-border bg-background px-2 text-sm"
				/>
			</div>
			<Button size="sm" variant="outline" onClick={saveAssignment} disabled={busy}>
				Save assignment
			</Button>

			{/* Review the submission */}
			{submission && mission.status === "submitted" && (
				<div className="space-y-2 border-t border-border pt-3">
					<div className="eyebrow">Submission to review</div>
					{submission.kind === "text" ? (
						<div className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
							{submission.text}
						</div>
					) : (
						<a
							href={submission.storageUrl}
							target="_blank"
							rel="noreferrer"
							className="inline-block text-sm font-medium text-foreground underline underline-offset-4"
						>
							📎 {submission.fileName ?? "Download file"}
						</a>
					)}
					<div className="flex flex-wrap items-center gap-2 pt-1">
						<Button size="sm" onClick={() => review("approve")} disabled={busy}>
							Approve
						</Button>
						<input
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							placeholder="Reason for rejection…"
							className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm"
						/>
						<Button
							size="sm"
							variant="destructive"
							onClick={() => review("reject")}
							disabled={busy || !reason.trim()}
						>
							Reject
						</Button>
					</div>
				</div>
			)}

			{mission.status === "validated" && (
				<TransferVerificationPanel
					mission={mission}
					verification={verification}
					users={users}
					people={people}
					currentUserId={currentUserId}
					onChanged={onChanged}
				/>
			)}

			{err && <p className="text-xs font-medium text-destructive">{err}</p>}
		</Card>
	);
}

function TransferVerificationPanel({
	mission,
	verification,
	users,
	people,
	currentUserId,
	onChanged,
}: {
	mission: Mission;
	verification?: TransferVerification;
	users: CompanyUser[];
	people: CompanyPerson[];
	currentUserId: string;
	onChanged: () => void;
}) {
	const [backupPersonId, setBackupPersonId] = useState("");
	const [competencyLevel, setCompetencyLevel] = useState(3);
	const [accessVerified, setAccessVerified] = useState(false);
	const [evidence, setEvidence] = useState("");
	const [rejectionReason, setRejectionReason] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	async function send(payload: Record<string, unknown>) {
		setBusy(true);
		setError("");
		try {
			const response = await fetch("/api/missions/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (!response.ok) {
				const body = await response.json().catch(() => ({})) as { error?: string };
				setError(body.error ?? "Verification failed.");
				return;
			}
			onChanged();
		} finally {
			setBusy(false);
		}
	}

	if (verification?.status === "proposed") {
		const currentPersonId = users.find((member) => member.id === currentUserId)?.personNodeId;
		const independent = Boolean(currentPersonId) &&
			currentUserId !== verification.assessorId &&
			currentPersonId !== verification.assessorPersonId &&
			currentPersonId !== verification.backupPersonId;
		return (
			<div className="space-y-3 border-t border-border pt-3">
				<div className="eyebrow">Independent transfer review</div>
				<p className="text-sm text-muted-foreground">
					Backup {verification.backupPersonId} · competency {verification.competencyLevel}/5 · access verified · {verification.evidenceRefs.length} evidence reference(s)
				</p>
				{independent ? (
					<div className="flex flex-wrap gap-2">
						<Button size="sm" disabled={busy} onClick={() => send({ action: "review", verificationId: verification.id, decision: "approve" })}>
							Approve transfer and recalculate risk
						</Button>
						<input className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Rejection reason…" />
						<Button size="sm" variant="destructive" disabled={busy || !rejectionReason.trim()} onClick={() => send({ action: "review", verificationId: verification.id, decision: "reject", rejectionReason })}>
							Reject
						</Button>
					</div>
				) : (
					<p className="text-sm text-amber-700">A mapped, independent validator must review this assessment. Owners manage identity mappings in Settings.</p>
				)}
				{error && <p className="text-xs font-medium text-destructive">{error}</p>}
			</div>
		);
	}

	return (
		<div className="space-y-3 border-t border-border pt-3">
			<div className="eyebrow">Verify a real backup</div>
			<div className="grid gap-2 sm:grid-cols-2">
				<select className="h-9 rounded-md border border-border bg-background px-2 text-sm" value={backupPersonId} onChange={(event) => setBackupPersonId(event.target.value)}>
					<option value="">Backup person…</option>
					{people.filter((item) => item.id !== users.find((member) => member.id === currentUserId)?.personNodeId).map((item) => (
						<option key={item.id} value={item.id}>{item.name}</option>
					))}
				</select>
				<select className="h-9 rounded-md border border-border bg-background px-2 text-sm" value={competencyLevel} onChange={(event) => setCompetencyLevel(Number(event.target.value))}>
					<option value={3}>Competency 3 — assisted</option>
					<option value={4}>Competency 4 — independent</option>
					<option value={5}>Competency 5 — can teach</option>
				</select>
			</div>
			<textarea className="w-full rounded-md border border-border bg-background p-2 text-sm" rows={2} value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Evidence references, one per line (artifact URL, observed run, assessment)…" />
			<label className="flex items-center gap-2 text-sm">
				<input type="checkbox" checked={accessVerified} onChange={(event) => setAccessVerified(event.target.checked)} />
				Required system, credential and physical access verified
			</label>
			<Button size="sm" disabled={busy || !backupPersonId || !accessVerified || !evidence.trim()} onClick={() => send({
				action: "submit",
				missionId: mission.id,
				backupPersonId,
				competencyLevel,
				accessVerified,
				evidenceRefs: evidence.split("\n").map((item) => item.trim()).filter(Boolean),
			})}>
				Submit transfer assessment
			</Button>
			{error && <p className="text-xs font-medium text-destructive">{error}</p>}
		</div>
	);
}
