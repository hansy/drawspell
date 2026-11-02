import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { languageRegistry, isAppLocale } from "@/i18n/locales";
import { pageUrlForLocale } from "@/i18n/urls";

export function LanguageSelector() {
  return (
    <select
      aria-label={m.language_label()}
      value={getLocale()}
      className="max-w-36 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
      onChange={(event) => {
        const locale = event.target.value;
        if (isAppLocale(locale)) {
          window.location.assign(pageUrlForLocale(new URL(window.location.href), locale));
        }
      }}
    >
      {languageRegistry.map(({ locale, nativeName }) => (
        <option key={locale} value={locale} lang={locale}>{nativeName}</option>
      ))}
    </select>
  );
}
