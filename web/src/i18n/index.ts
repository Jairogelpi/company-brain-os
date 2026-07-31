import en from "./en";
import es from "./es";

export type Translations = { [K in keyof typeof en]: string };
export type Lang = "en" | "es";

const translations: Record<Lang, { [K in keyof typeof en]: string }> = { en, es };

export function getTranslations(lang: Lang): Translations {
  return translations[lang];
}

export { en, es };
