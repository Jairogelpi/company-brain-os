"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div>
			<div className="eyebrow">{label}</div>
			<div className="mt-1 text-sm font-medium text-foreground">{value}</div>
		</div>
	);
}

type Invitation = {
	id: string;
	email: string;
	role: "validator" | "contributor" | "viewer";
	status: "pending" | "accepted" | "revoked" | "expired";
	expiresAt: string;
};

type WorkspaceUser = {
	id: string;
	name: string;
	email: string;
	role: string;
	personNodeId?: string;
};

type CanonicalPerson = {
	id: string;
	name: string;
	mappedUserId?: string;
};

function PersonIdentityManager() {
	const [users, setUsers] = useState<WorkspaceUser[]>([]);
	const [people, setPeople] = useState<CanonicalPerson[]>([]);
	const [saving, setSaving] = useState<string>();
	const [message, setMessage] = useState("");

	async function load() {
		const [usersResponse, peopleResponse] = await Promise.all([
			fetch("/api/users", { cache: "no-store" }),
			fetch("/api/people", { cache: "no-store" }),
		]);
		if (!usersResponse.ok || !peopleResponse.ok) {
			setMessage("Could not load identity mappings.");
			return;
		}
		const usersData = await usersResponse.json() as { users?: WorkspaceUser[] };
		const peopleData = await peopleResponse.json() as { people?: CanonicalPerson[] };
		setUsers(usersData.users ?? []);
		setPeople(peopleData.people ?? []);
	}

	useEffect(() => { void load(); }, []);

	async function mapUser(userId: string, personNodeId: string) {
		setSaving(userId);
		setMessage("");
		const response = await fetch(`/api/users/${userId}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ personNodeId: personNodeId || null }),
		});
		const result = await response.json().catch(() => ({})) as { error?: string };
		setSaving(undefined);
		if (!response.ok) {
			setMessage(result.error ?? "Mapping failed.");
			return;
		}
		setMessage("Canonical identity mapping saved.");
		await load();
	}

	return (
		<Card className="p-6">
			<CardContent className="p-0">
				<div className="eyebrow">Canonical person identities</div>
				<p className="mt-1.5 text-xs text-muted-foreground">
					Map each login to exactly one Person node. Transfer assessors and reviewers must be mapped, and cannot assess or review themselves.
				</p>
				<div className="mt-4 divide-y divide-border rounded-md border border-border">
					{users.map((member) => (
						<div key={member.id} className="grid gap-3 px-3 py-3 sm:grid-cols-[1fr_260px] sm:items-center">
							<div className="min-w-0">
								<div className="truncate text-sm font-medium">{member.name}</div>
								<div className="truncate text-xs text-muted-foreground">{member.email} · {member.role}</div>
							</div>
							<select
								aria-label={`Canonical Person for ${member.name}`}
								value={member.personNodeId ?? ""}
								disabled={saving === member.id}
								onChange={(event) => void mapUser(member.id, event.target.value)}
								className="h-9 rounded-md border border-border bg-background px-2 text-sm"
							>
								<option value="">Not mapped</option>
								{people.map((person) => (
									<option key={person.id} value={person.id} disabled={Boolean(person.mappedUserId && person.mappedUserId !== member.id)}>
										{person.name}{person.mappedUserId && person.mappedUserId !== member.id ? " (already mapped)" : ""}
									</option>
								))}
							</select>
						</div>
					))}
				</div>
				{message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
			</CardContent>
		</Card>
	);
}

function InvitationManager() {
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<Invitation["role"]>("contributor");
	const [items, setItems] = useState<Invitation[]>([]);
	const [inviteUrl, setInviteUrl] = useState("");
	const [message, setMessage] = useState("");
	const [busy, setBusy] = useState(false);

	async function load() {
		const response = await fetch("/api/users/invitations", { cache: "no-store" });
		if (!response.ok) return;
		const data = await response.json() as { items?: Invitation[] };
		setItems(data.items ?? []);
	}

	useEffect(() => { void load(); }, []);

	async function invite(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setMessage("");
		setInviteUrl("");
		const response = await fetch("/api/users/invitations", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email, role }),
		});
		const data = await response.json().catch(() => ({})) as { invitePath?: string; error?: string };
		setBusy(false);
		if (!response.ok || !data.invitePath) {
			setMessage(data.error ?? "Invitation failed.");
			return;
		}
		setEmail("");
		setInviteUrl(new URL(data.invitePath, window.location.origin).toString());
		setMessage("Invitation queued for email delivery.");
		await load();
	}

	return (
		<Card className="p-6">
			<CardContent className="p-0">
				<div className="eyebrow">Workspace invitations</div>
				<p className="mt-1.5 text-xs text-muted-foreground">Invite links expire after seven days. A new invite revokes the previous pending invite for the same email.</p>
				<form onSubmit={invite} className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
					<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="person@company.com" className="h-10 rounded-md border border-border bg-background px-3 text-sm" />
					<select value={role} onChange={(event) => setRole(event.target.value as Invitation["role"])} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
						<option value="validator">Validator</option>
						<option value="contributor">Contributor</option>
						<option value="viewer">Viewer</option>
					</select>
					<Button type="submit" disabled={busy}>{busy ? "Inviting…" : "Invite"}</Button>
				</form>
				{message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
				{inviteUrl && (
					<div className="mt-3 flex gap-2 rounded-md border border-border bg-muted p-3">
						<input readOnly value={inviteUrl} aria-label="Invitation link" className="min-w-0 flex-1 bg-transparent text-xs" />
						<Button type="button" size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(inviteUrl)}>Copy</Button>
					</div>
				)}
				{items.length > 0 && (
					<div className="mt-5 divide-y divide-border rounded-md border border-border">
						{items.slice(0, 10).map((item) => (
							<div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
								<div className="min-w-0"><div className="truncate font-medium">{item.email}</div><div className="text-xs text-muted-foreground">{item.role}</div></div>
								<Badge variant="secondary">{item.status}</Badge>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default function SettingsPage() {
	const { user } = useAuth();

	return (
		<div className="px-8 py-10 rise">
			<div className="border-b border-border pb-6">
				<div className="eyebrow">Account</div>
				<h1 className="text-[44px] font-semibold tracking-[-0.045em]">Settings</h1>
			</div>

			<div className="mt-8 max-w-3xl space-y-6">
				<Card className="p-6">
					<CardContent className="p-0">
						<div className="eyebrow">Profile</div>
						<div className="mt-4 grid gap-5 md:grid-cols-2">
							<Row label="Name" value={user?.name ?? "—"} />
							<Row label="Email" value={user?.email ?? "—"} />
							<Row
								label="Role"
								value={<Badge variant="secondary">{user?.role ?? "—"}</Badge>}
							/>
							<Row label="Company" value={user?.companyId ?? "—"} />
						</div>
					</CardContent>
				</Card>

				{(user?.role === "owner" || user?.role === "validator") && (
					<Card className="p-6">
						<CardContent className="p-0">
							<div className="eyebrow">Validation scopes</div>
							<p className="mt-1.5 text-xs text-muted-foreground">
								Domains this user can validate knowledge in.
							</p>
							<div className="mt-4">
								{user.validationDomains.length > 0 ? (
									<div className="flex flex-wrap gap-2">
										{user.validationDomains.map((domain) => (
											<Badge key={domain} variant="secondary">
												{domain}
											</Badge>
										))}
									</div>
								) : (
									<p className="text-sm text-muted-foreground">
										No validation scopes assigned.
									</p>
								)}
							</div>
						</CardContent>
					</Card>
				)}

				{user?.role === "owner" && <PersonIdentityManager />}
				{user?.role === "owner" && <InvitationManager />}
			</div>
		</div>
	);
}
