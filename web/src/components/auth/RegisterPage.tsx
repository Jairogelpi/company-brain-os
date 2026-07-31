"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import AuthShell from "./AuthShell";
import { useLang } from "./LanguageContext";
import {
	normalizeSignupBody,
	validateSignup,
	type SignupField,
} from "@/auth/signup-validation";

const inputBase: React.CSSProperties = {
	width: "100%",
	height: 48,
	padding: "0 16px",
	fontFamily: "inherit",
	fontSize: 15,
	color: "#0c0d0f",
	background: "#fff",
	border: "1.5px solid #d7dade",
	borderRadius: 11,
	outline: "none",
	boxShadow: "0 1px 2px rgba(16,18,22,0.07)",
	transition: "box-shadow .2s, border-color .2s",
	boxSizing: "border-box",
};

const inputError: React.CSSProperties = {
	borderColor: "#bb1532",
};

function Field({
	label, id, type = "text", placeholder, autoComplete, value,
	onChange, invalid,
}: {
	label: string; id: string; type?: string; placeholder: string;
	autoComplete?: string; value: string; onChange: (v: string) => void;
	invalid?: boolean;
}) {
	return (
		<div>
			<label htmlFor={id} style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3a3d42", marginBottom: 8 }}>
				{label}
			</label>
			<input
				id={id}
				type={type}
				placeholder={placeholder}
				autoComplete={autoComplete}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				aria-invalid={invalid}
				style={{ ...inputBase, ...(invalid ? inputError : {}) }}
				onFocus={(e) => { e.target.style.borderColor = "#1d1f23"; e.target.style.boxShadow = "0 0 0 4px rgba(20,22,26,0.08)"; }}
				onBlur={(e) => { e.target.style.borderColor = invalid ? "#bb1532" : "#d7dade"; e.target.style.boxShadow = "0 1px 2px rgba(16,18,22,0.07)"; }}
			/>
		</div>
	);
}

export default function RegisterPage() {
	const router = useRouter();
	const { t } = useLang();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [errorField, setErrorField] = useState<SignupField | "form" | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setErrorField(null);
		const body = { email, password, companyName };
		const validation = validateSignup(body);
		if (validation) {
			setErrorField(validation.field);
			setError(t.errorCheck);
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
					? t.errorConflict
					: t.errorGeneric,
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
		<AuthShell>
			{/* Eyebrow */}
			<div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: "#9aa0a9", textTransform: "uppercase" }}>
				{t.createAccount}
			</div>

			{/* Title */}
			<h2 style={{ margin: "8px 0 6px", fontSize: 36, fontWeight: 700, letterSpacing: "-0.025em", color: "#0c0d0f", lineHeight: 1.05 }}>
				{t.startWorkspace}
			</h2>
			<p style={{ margin: "0 0 28px", fontSize: 14, color: "#6c727b", lineHeight: 1.5 }}>
				{t.workspaceDesc}
			</p>

			<form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
				<Field label={t.email} id="email" type="email" placeholder={t.emailPh} autoComplete="email" value={email} onChange={setEmail} invalid={errorField === "email"} />

				<Field label={t.companyName} id="companyName" placeholder={t.companyPh} autoComplete="organization" value={companyName} onChange={setCompanyName} invalid={errorField === "companyName"} />

				<Field label={t.password} id="password" type="password" placeholder={t.passPh} autoComplete="new-password" value={password} onChange={setPassword} invalid={errorField === "password"} />

				{error && (
					<p style={{ fontSize: 13, color: "#bb1532", fontWeight: 500, margin: 0 }}>{error}</p>
				)}

				<button
					type="submit"
					disabled={loading}
					style={{
						width: "100%", height: 50,
						fontFamily: "inherit", fontSize: 15.5, fontWeight: 600,
						color: "#fff", background: "#0c0d0f",
						border: "none", borderRadius: 11,
						cursor: loading ? "not-allowed" : "pointer",
						opacity: loading ? 0.65 : 1,
						boxShadow: "0 10px 22px -8px rgba(12,13,15,0.45)",
						transition: "transform .18s cubic-bezier(.2,.7,.2,1), box-shadow .25s, opacity .15s",
						marginTop: 4,
					}}
					onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 24px rgba(12,13,15,0.28)"; } }}
					onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 10px 22px -8px rgba(12,13,15,0.45)"; }}
				>
					{loading ? t.creating : t.submit}
				</button>
			</form>

			<div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#6c727b" }}>
				{t.haveAccount}{" "}
				<Link href="/login" style={{ color: "#0c0d0f", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>
					{t.logIn}
				</Link>
			</div>
		</AuthShell>
	);
}
