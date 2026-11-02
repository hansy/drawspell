import { localeHref } from "@/i18n/navigation";
import { m } from "@/paraglide/messages.js";
import type { LucideIcon } from "lucide-react";
import { Github, Mail } from "lucide-react";

type FooterLink = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

type FooterLinksProps = {
  links?: FooterLink[];
};

const defaultLinks: FooterLink[] = [
  {
    href: "https://github.com/hansy/drawspell",
    get label() { return m.footer_links_github(); },
    Icon: Github,
  },
  {
    href: "mailto:feedback@drawspell.space",
    get label() { return m.footer_links_feedback(); },
    Icon: Mail,
  },
];

export function FooterLinks({ links = defaultLinks }: FooterLinksProps) {
  return (
    <footer className="mx-6 border-t border-white/10 pb-5 pt-3 text-xs text-zinc-400 sm:mx-10">
      <nav aria-label={m.footer_links_site_links()} className="flex items-center gap-5">
        {[
          { href: "/docs", label: m.footer_links_api() },
          { href: "/tos", label: m.footer_links_terms() },
          { href: "/privacy", label: m.footer_links_privacy() },
        ].map(({ href, label }) => (
          <a key={href} href={localeHref(href)} className="inline-flex min-h-11 items-center rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300">
            {label}
          </a>
        ))}
      </nav>
      <div className="flex items-center justify-between gap-3 text-zinc-500">
        <nav aria-label={m.footer_links_community_and_contact()} className="-ml-3.5 flex items-center gap-1">
        {links.map(({ href, label, Icon }) => (
          <a
            key={href}
            href={localeHref(href)}
            aria-label={label}
            title={label}
            className="inline-flex size-11 items-center justify-center rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300"
          >
            <Icon className="size-4" aria-hidden="true" />
          </a>
        ))}
        </nav>
        <a
          href="https://scryfall.com"
          className="inline-flex min-h-9 items-center whitespace-nowrap rounded-sm transition-colors hover:text-zinc-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300"
        >
          {m.footer_links_powered_by_scryfall()}</a>
      </div>
    </footer>
  );
}
