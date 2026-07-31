"use client";

import { useLang } from "@/components/auth/LanguageContext";

export default function LangToggle() {
	const { lang, setLang } = useLang();

	const btn: React.CSSProperties = {
		fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
		fontSize: 12,
		letterSpacing: "0.06em",
		padding: "9px 13px",
		border: "none",
		cursor: "pointer",
		transition: "background .15s, color .15s",
	};

	const activeBg = "var(--color-foreground)";
	const activeColor = "var(--color-background)";
	const inactiveColor = "var(--text-3)";

	return (
		<div style={{ display: "flex", border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
			<button
				type="button"
				onClick={() => setLang("en")}
				style={{
					...btn,
					background: lang === "en" ? activeBg : "transparent",
					color: lang === "en" ? activeColor : inactiveColor,
				}}
			>
				EN
			</button>
			<button
				type="button"
				onClick={() => setLang("es")}
				style={{
					...btn,
					background: lang === "es" ? activeBg : "transparent",
					color: lang === "es" ? activeColor : inactiveColor,
				}}
			>
				ES
			</button>
		</div>
	);
}
