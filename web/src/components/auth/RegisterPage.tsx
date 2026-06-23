"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import AuthShell from "./AuthShell";
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
		<AuthShell
			eyebrow="Self-serve pilot"
			title={
				<>
					Map your organization&apos;s brain{" "}
					<mark className="box-decoration-clone rounded-[4px] bg-primary px-1.5 text-primary-foreground">
						in minutes.
					</mark>
				</>
			}
			subtitle="Start with a private company workspace, then map people, knowledge, and the dependencies your business can't afford to lose."
			footer="Owner account · New company"
		>
			<div className="eyebrow">Create account</div>
			<h2 className="mt-2 text-[32px] font-normal leading-tight tracking-tight">
				Start your workspace
			</h2>
			<p className="mt-2 text-sm text-muted-foreground">
				You will become the owner of a new company workspace.
			</p>

			<form onSubmit={handleSubmit} className="mt-10 space-y-4">
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
				<div className="grid gap-4 sm:grid-cols-2">
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

				{error && (
					<p className="text-xs font-medium text-destructive">{error}</p>
				)}

				<Button type="submit" disabled={loading} className="mt-2 h-11 w-full">
					{loading ? "Creating account…" : "Create account"}
				</Button>
			</form>

			<p className="mt-6 text-sm text-muted-foreground">
				Already have an account?{" "}
				<Link
					href="/login"
					className="font-medium text-foreground underline-offset-4 hover:underline"
				>
					Log in
				</Link>
			</p>
		</AuthShell>
	);
}
