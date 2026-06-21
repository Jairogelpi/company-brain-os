"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
	const [errorField, setErrorField] = useState<SignupField | "form" | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async () => {
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
			setError(payload.error === "Conflict" ? "Email or company slug already exists." : "Could not create account.");
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
			<div className="relative hidden flex-col justify-between overflow-hidden border-r bg-[var(--ink)] p-12 text-[var(--paper)] lg:flex">
				<div className="relative flex items-center gap-2.5">
					<span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--paper)] text-[13px] font-semibold text-[var(--ink)]">
						◐
					</span>
					<span className="font-display text-lg font-semibold">Company Brain</span>
				</div>

				<div className="relative max-w-md rise">
					<div className="eyebrow text-[var(--paper)]/50">Self-serve pilot</div>
					<h1 className="mt-4 font-display text-[44px] font-light leading-[1.05] tracking-tight">
						Create your company brain in minutes.
					</h1>
					<p className="mt-5 text-sm leading-relaxed text-[var(--paper)]/60">
						Start with a private company workspace, then map people, knowledge, and critical dependencies.
					</p>
				</div>

				<div className="relative eyebrow text-[var(--paper)]/40">Owner account · New company</div>
			</div>

			<div className="flex items-center justify-center p-6">
				<div className="w-full max-w-sm rise">
					<div className="mb-8 lg:hidden">
						<span className="font-display text-xl font-semibold">Company Brain</span>
					</div>

					<div className="eyebrow">Create account</div>
					<h2 className="mt-2 font-display text-3xl font-normal">Start your workspace</h2>
					<p className="mt-1.5 text-sm text-[var(--ink-2)]">
						You will become the owner of a new company workspace.
					</p>

					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleSubmit();
						}}
						className="mt-8 space-y-3"
					>
						<Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@company.com" autoComplete="email" error={errorField === "email"} />
						<Field label="Password" value={password} onChange={setPassword} type="password" placeholder="Minimum 8 characters" autoComplete="new-password" error={errorField === "password"} />
						<Field label="Company name" value={companyName} onChange={setCompanyName} type="text" placeholder="Acme Corp" autoComplete="organization" error={errorField === "companyName"} />
						<Field label="Company slug" value={slug} onChange={setSlug} type="text" placeholder="acme-corp" autoComplete="off" error={errorField === "slug"} />

						{error && <p className="text-xs font-medium text-[var(--risk)]">{error}</p>}

						<button
							type="submit"
							disabled={loading}
							className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] py-3 text-sm font-medium text-[var(--paper)] transition-all hover:bg-[var(--cobalt-ink)] disabled:opacity-50"
						>
							{loading ? "Creating account…" : "Create account"}
							{!loading && <span className="transition-transform group-hover:translate-x-0.5">→</span>}
						</button>
					</form>

					<p className="mt-5 text-center text-sm text-[var(--ink-2)]">
						Already have an account?{" "}
						<Link href="/login" className="font-medium text-[var(--ink)] underline-offset-4 hover:underline">
							Log in
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}

function Field({
	label,
	value,
	onChange,
	type,
	placeholder,
	autoComplete,
	error,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	type: string;
	placeholder: string;
	autoComplete: string;
	error?: boolean;
}) {
	return (
		<label className="block">
			<span className="eyebrow">{label}</span>
			<input
				value={value}
				onChange={(e) => onChange(e.target.value)}
				type={type}
				placeholder={placeholder}
				autoComplete={autoComplete}
				className={`mt-1.5 w-full rounded-xl border bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--ink)] outline-none transition-all placeholder:text-[var(--ink-3)] focus:ring-2 ${
					error
						? "border-[var(--risk)] focus:border-[var(--risk)] focus:ring-[var(--risk)]/15"
						: "border-[var(--hairline)] focus:border-[var(--cobalt)] focus:ring-[var(--cobalt)]/15"
				}`}
			/>
		</label>
	);
}
