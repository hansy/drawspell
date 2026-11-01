/** BCP 47 app locales. Scryfall's Chinese identifiers are API codes, not locales. */
export const languageRegistry = [
  { locale: "en", nativeName: "English", scryfall: "en" },
  { locale: "es", nativeName: "Español", scryfall: "es" },
  { locale: "fr", nativeName: "Français", scryfall: "fr" },
  { locale: "de", nativeName: "Deutsch", scryfall: "de" },
  { locale: "it", nativeName: "Italiano", scryfall: "it" },
  { locale: "pt", nativeName: "Português", scryfall: "pt" },
  { locale: "ja", nativeName: "日本語", scryfall: "ja" },
  { locale: "ko", nativeName: "한국어", scryfall: "ko" },
  { locale: "ru", nativeName: "Русский", scryfall: "ru" },
  { locale: "zh-Hans", nativeName: "简体中文", scryfall: "zhs" },
  { locale: "zh-Hant", nativeName: "繁體中文", scryfall: "zht" },
] as const;

export type AppLocale = (typeof languageRegistry)[number]["locale"];
export type ScryfallLanguage = (typeof languageRegistry)[number]["scryfall"];
export const baseLocale = "en" satisfies AppLocale;
export const locales: AppLocale[] = languageRegistry.map(({ locale }) => locale);

export const isAppLocale = (value: string): value is AppLocale =>
  languageRegistry.some(({ locale }) => locale === value);

export const toScryfallLanguage = (locale: AppLocale): ScryfallLanguage =>
  languageRegistry.find((language) => language.locale === locale)!.scryfall;
