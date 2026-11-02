/** BCP 47 app locales. Scryfall's Chinese identifiers are API codes, not locales. */
export const languageRegistry = [
  { locale: "en", flag: "us", nativeName: "English", scryfall: "en" },
  { locale: "es", flag: "es", nativeName: "Español", scryfall: "es" },
  { locale: "fr", flag: "fr", nativeName: "Français", scryfall: "fr" },
  { locale: "de", flag: "de", nativeName: "Deutsch", scryfall: "de" },
  { locale: "it", flag: "it", nativeName: "Italiano", scryfall: "it" },
  { locale: "pt", flag: "br", nativeName: "Português", scryfall: "pt" },
  { locale: "ja", flag: "jp", nativeName: "日本語", scryfall: "ja" },
  { locale: "ko", flag: "kr", nativeName: "한국어", scryfall: "ko" },
  { locale: "ru", flag: "ru", nativeName: "Русский", scryfall: "ru" },
  { locale: "zh-Hans", flag: "cn", nativeName: "简体中文", scryfall: "zhs" },
  { locale: "zh-Hant", flag: "tw", nativeName: "繁體中文", scryfall: "zht" },
] as const;

export type AppLocale = (typeof languageRegistry)[number]["locale"];
export type ScryfallLanguage = (typeof languageRegistry)[number]["scryfall"];
export const baseLocale = "en" satisfies AppLocale;
export const locales: AppLocale[] = languageRegistry.map(({ locale }) => locale);

export const isAppLocale = (value: string): value is AppLocale =>
  languageRegistry.some(({ locale }) => locale === value);

export const toScryfallLanguage = (locale: AppLocale): ScryfallLanguage =>
  languageRegistry.find((language) => language.locale === locale)!.scryfall;
