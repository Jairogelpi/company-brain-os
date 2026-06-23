"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import AuthShell from "./AuthShell";

export default function LoginPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get("callbackUrl") || "/";

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleLogin = async () => {
		setError("");
		setLoading(true);
		const res = await signIn("credentials", {
			email: email.trim(),
			password,
			redirect: false,
		});
		setLoading(false);
		if (!res || res.error) {
			setError("Invalid email or password.");
			return;
		}
		router.push(callbackUrl);
		router.refresh();
	};

	return (
		<AuthShell
			eyebrow="Knowledge-risk intelligence"
			title={
				<>
					Know who knows what —{" "}
					<mark className="box-decoration-clone rounded-[4px] bg-primary px-1.5 text-primary-foreground">
						before they walk out the door.
					</mark>
				</>
			}
			subtitle="Map people, knowledge and critical dependencies, then see your single points of failure before they cost you."
			footer="v0.10 · Secure pilot"
		>
			<div className="eyebrow">Sign in</div>
			<h2 className="mt-2 text-[32px] font-normal leading-tight tracking-tight">
				Welcome back
			</h2>
			<p className="mt-2 text-sm text-muted-foreground">
				Access your organization&apos;s knowledge graph.
			</p>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					handleLogin();
				}}
				className="mt-10 space-y-4"
			>
				<div className="space-y-1.5">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						type="email"
						placeholder="you@company.com"
						autoComplete="email"
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="password">Password</Label>
					<Input
						id="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						type="password"
						placeholder="••••••••"
						autoComplete="current-password"
					/>
				</div>

				{error && (
					<p className="text-xs font-medium text-destructive">{error}</p>
				)}

				<Button type="submit" disabled={loading} className="mt-2 h-11 w-full">
					{loading ? "Signing in…" : "Sign in"}
				</Button>
			</form>

			<p className="mt-6 text-sm text-muted-foreground">
				New here?{" "}
				<Link
					href="/register"
					className="font-medium text-foreground underline-offset-4 hover:underline"
				>
					Create account
				</Link>
			</p>
		</AuthShell>
	);
}
