import { m } from "@/paraglide/messages.js";
import { LanguageSelector } from "@/components/LanguageSelector";
import { localeHref } from "@/i18n/navigation";
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-6 pt-6 sm:px-10">
      <a
        href={localeHref("/")}
        className="text-md font-semibold uppercase tracking-[0.3em] text-zinc-200/80 transition hover:text-zinc-50"
      >
        {m.site_header_drawspell()}</a>
      <LanguageSelector />
    </header>
  );
}
