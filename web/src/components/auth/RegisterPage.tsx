"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import GraphHero from "./GraphHero";
import {
	normalizeSignupBody,
	validateSignup,
	type SignupField,
} from "@/auth/signup-validation";

export default function RegisterPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [slug, setSlug] = useState("");
	const [errorField, setErrorField] = useState<SignupField | "form" | null>(
		null,
	);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setErrorField(null);
		const body = { email, password, companyName, slug };
		const validation = validateSignup(body);
		if (validation) {
			setErrorField(validation.field);
			setError("Check the highlighted field.");
			return;
		}

		setLoading(true);
		const normalized = normalizeSignupBody(body);
		const res = await fetch("/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(normalized),
		});

		if (!res.ok) {
			setLoading(false);
			const payload = (await res.json().catch(() => ({}))) as {
				field?: SignupField;
				error?: string;
			};
			setErrorField(payload.field ?? "form");
			setError(
				payload.error === "Conflict"
					? "Email or company slug already exists."
					: "Could not create account.",
			);
			return;
		}

		const signInResult = await signIn("credentials", {
			email: normalized.email,
			password: normalized.password,
			redirect: false,
		});
		setLoading(false);

		if (!signInResult || signInResult.error) {
			setErrorField("form");
			setError("Account created. Please log in.");
			return;
		}

		router.push("/");
		router.refresh();
	};

	return (
		<div className="grid min-h-screen lg:grid-cols-2">
			<div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-foreground p-12 text-background lg:flex">
				<div className="relative flex items-center gap-2.5">
					<span className="flex h-7 w-7 items-center justify-center rounded-md bg-background text-[13px] font-semibold text-foreground">
						◐
					</span>
					<span className="text-lg font-medium">Company Brain</span>
				</div>

				<div className="relative max-w-md rise">
					<div className="eyebrow text-background/50">Self-serve pilot</div>
					<h1 className="mt-4 text-[44px] font-normal leading-[1.05] tracking-tight">
						Map your organization&apos;s brain in minutes.
					</h1>
					<p className="mt-5 text-sm leading-relaxed text-background/60">
						Start with a private company workspace, then map people, knowledge,
						and critical dependencies.
					</p>
					<div className="mt-6 h-48 w-full">
						<GraphHero />
					</div>
				</div>

				<div className="relative eyebrow text-background/40">
					Owner account · New company
				</div>
			</div>

			<div className="flex items-center justify-center bg-background p-6">
				<div className="w-full max-w-sm rise">
					<div className="mb-8 lg:hidden">
						<span className="text-xl font-medium">Company Brain</span>
					</div>

					<Card className="p-6">
						<CardContent className="p-0">
							<div className="eyebrow">Create account</div>
							<h2 className="mt-2 text-3xl font-normal">
								Start your workspace
							</h2>
							<p className="mt-1.5 text-sm text-muted-foreground">
								You will become the owner of a new company workspace.
							</p>

							<form onSubmit={handleSubmit} className="mt-8 space-y-3">
								<div className="space-y-1.5">
									<Label htmlFor="email">Email</Label>
									<Input
										id="email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										type="email"
										placeholder="you@company.com"
										autoComplete="email"
										aria-invalid={errorField === "email"}
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="password">Password</Label>
									<Input
										id="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										type="password"
										placeholder="Minimum 8 characters"
										autoComplete="new-password"
										aria-invalid={errorField === "password"}
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="companyName">Company name</Label>
									<Input
										id="companyName"
										value={companyName}
										onChange={(e) => setCompanyName(e.target.value)}
										type="text"
										placeholder="Acme Corp"
										autoComplete="organization"
										aria-invalid={errorField === "companyName"}
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="slug">Company slug</Label>
									<Input
										id="slug"
										value={slug}
										onChange={(e) => setSlug(e.target.value)}
										type="text"
										placeholder="acme-corp"
										autoComplete="off"
										aria-invalid={errorField === "slug"}
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
									{loading ? "Creating account…" : "Create account"}
								</Button>
							</form>

							<p className="mt-5 text-center text-sm text-muted-foreground">
								Already have an account?{" "}
								<Link
									href="/login"
									className="font-medium text-foreground underline-offset-4 hover:underline"
								>
									Log in
								</Link>
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
