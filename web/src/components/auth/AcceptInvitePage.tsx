"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthShell from "./AuthShell";

export default function AcceptInvitePage({ token }: { token: string }) {
	const router = useRouter();
	const [name, setName] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	useEffect(() => {
		window.history.replaceState(null, "", "/accept-invite");
	}, []);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError("");
		const response = await fetch("/api/auth/accept-invite", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ token, name, password }),
		});
		const result = await response.json().catch(() => ({})) as { email?: string; error?: string };
		if (!response.ok || !result.email) {
			setBusy(false);
			setError(result.error ?? "Could not accept invitation.");
			return;
		}
		const signedIn = await signIn("credentials", {
			email: result.email,
			password,
			redirect: false,
		});
		setBusy(false);
		if (!signedIn || signedIn.error) {
			setError("Account created. Please sign in.");
			return;
		}
		router.push("/");
		router.refresh();
	}

	return (
		<AuthShell>
			<div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: "#9aa0a9", textTransform: "uppercase" }}>Company Brain</div>
			<h2 style={{ margin: "8px 0 6px", fontSize: 36, fontWeight: 700, color: "#0c0d0f" }}>Accept invitation</h2>
			<p style={{ margin: "0 0 28px", fontSize: 14, color: "#6c727b" }}>Create your account for this workspace.</p>
			<form onSubmit={submit} className="space-y-4">
				<label className="block text-sm font-medium text-slate-800">
					Name
					<input className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} />
				</label>
				<label className="block text-sm font-medium text-slate-800">
					Password
					<input className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" />
					<span className="mt-1 block text-xs text-slate-500">12–128 characters</span>
				</label>
				{error && <p className="text-sm font-medium text-red-700">{error}</p>}
				<button type="submit" disabled={busy || !token} className="h-12 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white disabled:opacity-50">
					{busy ? "Creating account…" : "Join workspace"}
				</button>
			</form>
		</AuthShell>
	);
}
