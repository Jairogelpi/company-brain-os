"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "./AuthShell";
import { useLang } from "./LanguageContext";

const inputBase: React.CSSProperties = {
	width: "100%",
	height: 48,
	padding: "0 16px",
	fontFamily: "inherit",
	fontSize: 15,
	color: "#0c0d0f",
	background: "#fff",
	borderRadius: 11,
	outline: "none",
	boxShadow: "0 1px 2px rgba(16,18,22,0.07)",
	transition: "box-shadow .2s, border-color .2s",
	boxSizing: "border-box",
};

export default function LoginPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get("callbackUrl") || "/";
	const { t } = useLang();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPw, setShowPw] = useState(false);
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
			setError(t.loginError);
			return;
		}
		router.push(callbackUrl);
		router.refresh();
	};

	return (
		<AuthShell>
			{/* Eyebrow */}
			<div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: "#9aa0a9", textTransform: "uppercase" }}>
				{t.signIn}
			</div>

			{/* Title */}
			<h2 style={{ margin: "8px 0 34px", fontSize: 42, fontWeight: 700, letterSpacing: "-0.025em", color: "#0c0d0f", lineHeight: 1.05 }}>
				{t.welcome}
			</h2>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					handleLogin();
				}}
			>
				{/* Email */}
				<label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3a3d42", marginBottom: 8 }}>
					{t.email}
				</label>
				<input
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					type="email"
					placeholder={t.emailPh}
					autoComplete="email"
					style={{ ...inputBase, border: "1.5px solid #1d1f23", marginBottom: 20 }}
					onFocus={(e) => { e.target.style.boxShadow = "0 0 0 4px rgba(20,22,26,0.08)"; }}
					onBlur={(e) => { e.target.style.boxShadow = "0 1px 2px rgba(16,18,22,0.07)"; }}
				/>

				{/* Password */}
				<label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3a3d42", marginBottom: 8 }}>
					{t.password}
				</label>
				<div style={{ position: "relative", marginBottom: 28 }}>
					<input
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						type={showPw ? "text" : "password"}
						placeholder={t.passPh}
						autoComplete="current-password"
						style={{ ...inputBase, border: "1.5px solid #d7dade", paddingRight: 46 }}
						onFocus={(e) => { e.target.style.borderColor = "#1d1f23"; e.target.style.boxShadow = "0 0 0 4px rgba(20,22,26,0.08)"; }}
						onBlur={(e) => { e.target.style.borderColor = "#d7dade"; e.target.style.boxShadow = "0 1px 2px rgba(16,18,22,0.07)"; }}
					/>
					<button
						type="button"
						onClick={() => setShowPw(!showPw)}
						style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#9aa0a9" }}
						aria-label={showPw ? "Hide password" : "Show password"}
					>
						{showPw ? (
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
								<path d="M2 2l16 16M8.5 8.6A2.6 2.6 0 0 0 10 13a2.6 2.6 0 0 0 2.6-2.6" stroke="#9aa0a9" strokeWidth="1.4" strokeLinecap="round" />
								<path d="M5.2 5.3C3.3 6.5 1.5 8.4 1.5 10S4.5 15.5 10 15.5c1.8 0 3.4-.5 4.8-1.3" stroke="#9aa0a9" strokeWidth="1.4" strokeLinecap="round" />
								<path d="M18.5 10c0-1.2-1.2-3-3.2-4.4" stroke="#9aa0a9" strokeWidth="1.4" strokeLinecap="round" />
							</svg>
						) : (
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
								<path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z" stroke="#9aa0a9" strokeWidth="1.4" />
								<circle cx="10" cy="10" r="2.6" stroke="#9aa0a9" strokeWidth="1.4" />
							</svg>
						)}
					</button>
				</div>

				{error && (
					<p style={{ fontSize: 13, color: "#bb1532", marginBottom: 16, fontWeight: 500 }}>{error}</p>
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
					}}
					onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 24px rgba(12,13,15,0.28)"; } }}
					onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 10px 22px -8px rgba(12,13,15,0.45)"; }}
				>
					{loading ? t.submitting : t.submit}
				</button>
			</form>

			<div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#6c727b" }}>
				{t.newUser}{" "}
				<Link href="/register" style={{ color: "#0c0d0f", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>
					{t.create}
				</Link>
			</div>
		</AuthShell>
	);
}
