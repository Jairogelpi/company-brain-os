"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import GraphHeroPlayer from "./GraphHeroPlayer";

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
		<div className="grid min-h-screen lg:grid-cols-[3fr_7fr]">
			{/* Brand / hero graph */}
			<div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-foreground p-12 text-background lg:flex">
				<div className="relative flex items-center gap-2.5">
					<span className="flex h-7 w-7 items-center justify-center rounded-md bg-background text-[13px] font-semibold text-foreground">
						◐
					</span>
					<span className="text-lg font-medium">Company Brain</span>
				</div>

				<div className="relative max-w-md rise">
					<div className="eyebrow text-background/50">
						Knowledge-risk intelligence
					</div>
					<h1 className="mt-4 text-[44px] font-normal leading-[1.05] tracking-tight">
						Know who knows what —{" "}
						<span className="italic text-background/70">
							before they walk out the door.
						</span>
					</h1>
					<div className="mt-6 h-48 w-full">
						<GraphHeroPlayer />
					</div>
				</div>

				<div className="relative eyebrow text-background/40">
					v0.10 · Secure pilot
				</div>
			</div>

			{/* Form */}
			<div className="flex items-center justify-center bg-background p-6">
				<div className="w-full max-w-sm rise">
					<div className="mb-8 lg:hidden">
						<span className="text-xl font-medium">Company Brain</span>
					</div>

					<Card className="p-6">
						<CardContent className="p-0">
							<div className="eyebrow">Sign in</div>
							<h2 className="mt-2 text-3xl font-normal">Welcome back</h2>
							<p className="mt-1.5 text-sm text-muted-foreground">
								Access your organization&apos;s knowledge graph.
							</p>

							<form
								onSubmit={(e) => {
									e.preventDefault();
									handleLogin();
								}}
								className="mt-8 space-y-3"
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
									<p className="text-xs font-medium text-destructive">
										{error}
									</p>
								)}

								<Button
									type="submit"
									disabled={loading}
									className="mt-2 w-full"
								>
									{loading ? "Signing in…" : "Sign in"}
								</Button>
							</form>

							<p className="mt-5 text-center text-sm text-muted-foreground">
								New here?{" "}
								<Link
									href="/register"
									className="font-medium text-foreground underline-offset-4 hover:underline"
								>
									Create account
								</Link>
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
