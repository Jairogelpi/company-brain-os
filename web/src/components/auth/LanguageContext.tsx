"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getTranslations, type Lang, type Translations } from "@/i18n";

type Ctx = { lang: Lang; t: Translations; setLang: (l: Lang) => void };

const LangContext = createContext<Ctx>({
	lang: "en",
	t: getTranslations("en"),
	setLang: () => {},
});

export function useLang() {
	return useContext(LangContext);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
	const [lang, setLangState] = useState<Lang>("en");

	useEffect(() => {
		try {
			const saved = localStorage.getItem("cb_lang");
			if (saved === "en" || saved === "es") setLangState(saved);
		} catch {}
	}, []);

	const setLang = (l: Lang) => {
		setLangState(l);
		try { localStorage.setItem("cb_lang", l); } catch {}
	};

	const t = getTranslations(lang);

	return (
		<LangContext.Provider value={{ lang, t, setLang }}>
			{children}
		</LangContext.Provider>
	);
}
