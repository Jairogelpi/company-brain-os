"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

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
		<div className="grid min-h-screen lg:grid-cols-2">
			{/* Brand / manifesto */}
			<div className="relative hidden flex-col justify-between overflow-hidden border-r bg-[var(--ink)] p-12 text-[var(--paper)] lg:flex">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 opacity-[0.5]"
					style={{
						backgroundImage:
							"radial-gradient(60% 50% at 80% 0%, rgba(34,64,255,0.45), transparent 60%), radial-gradient(50% 50% at 0% 100%, rgba(176,125,46,0.28), transparent 60%)",
					}}
				/>
				<div className="relative flex items-center gap-2.5">
					<span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--paper)] text-[13px] font-semibold text-[var(--ink)]">
						◐
					</span>
					<span className="font-display text-lg font-semibold">
						Company Brain
					</span>
				</div>

				<div className="relative max-w-md rise">
					<div className="eyebrow text-[var(--paper)]/50">
						Knowledge-risk intelligence
					</div>
					<h1 className="mt-4 font-display text-[44px] font-light leading-[1.05] tracking-tight">
						Know who knows what —{" "}
						<span className="italic text-[var(--paper)]/70">
							before they walk out the door.
						</span>
					</h1>
					<p className="mt-5 text-sm leading-relaxed text-[var(--paper)]/60">
						A living graph of your organization&apos;s expertise, dependencies,
						and single points of failure.
					</p>
				</div>

				<div className="relative eyebrow text-[var(--paper)]/40">
					v0.10 · Secure pilot
				</div>
			</div>

			{/* Form */}
			<div className="flex items-center justify-center p-6">
				<div className="w-full max-w-sm rise">
					<div className="mb-8 lg:hidden">
						<span className="font-display text-xl font-semibold">
							Company Brain
						</span>
					</div>

					<div className="eyebrow">Sign in</div>
					<h2 className="mt-2 font-display text-3xl font-normal">
						Welcome back
					</h2>
					<p className="mt-1.5 text-sm text-[var(--ink-2)]">
						Access your organization&apos;s knowledge graph.
					</p>

					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleLogin();
						}}
						className="mt-8 space-y-3"
					>
						<Field
							label="Email"
							value={email}
							onChange={setEmail}
							type="email"
							placeholder="you@company.com"
							autoComplete="email"
						/>
						<Field
							label="Password"
							value={password}
							onChange={setPassword}
							type="password"
							placeholder="••••••••"
							autoComplete="current-password"
						/>

						{error && (
							<p className="text-xs font-medium text-[var(--risk)]">{error}</p>
						)}

						<button
							type="submit"
							disabled={loading}
							className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] py-3 text-sm font-medium text-[var(--paper)] transition-all hover:bg-[var(--cobalt-ink)] disabled:opacity-50"
						>
							{loading ? "Signing in…" : "Sign in"}
							{!loading && (
								<span className="transition-transform group-hover:translate-x-0.5">
									→
								</span>
							)}
						</button>
					</form>
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
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	type: string;
	placeholder: string;
	autoComplete: string;
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
				className="mt-1.5 w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--ink)] outline-none transition-all placeholder:text-[var(--ink-3)] focus:border-[var(--cobalt)] focus:ring-2 focus:ring-[var(--cobalt)]/15"
			/>
		</label>
	);
}
