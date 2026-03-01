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
    label: "Drawspell on GitHub",
    Icon: Github,
  },
  {
    href: "mailto:feedback@drawspell.space",
    label: "Send Feedback!",
    Icon: Mail,
  },
];

export function FooterLinks({ links = defaultLinks }: FooterLinksProps) {
  return (
    <footer
      className="flex flex-col gap-4 px-6 pb-6 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between sm:px-10"
      style={{
        fontFamily:
          '"Space Mono", "IBM Plex Mono", "Menlo", "Monaco", "Consolas", "Liberation Mono", monospace',
      }}
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group inline-flex items-center transition hover:text-zinc-100"
              aria-label={link.label}
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-400/40 transition group-hover:border-zinc-200">
                <link.Icon className="h-4 w-4" />
              </span>
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3 uppercase tracking-[0.18em] text-zinc-400/90">
          <a href="/tos" className="transition hover:text-zinc-100">
            Terms
          </a>
          <span aria-hidden="true" className="text-zinc-600">
            /
          </span>
          <a href="/privacy" className="transition hover:text-zinc-100">
            Privacy
          </a>
        </div>
      </div>
      <a
        href="https://scryfall.com"
        className="uppercase tracking-[0.3em] transition hover:text-zinc-100"
        style={{
          fontFamily:
            '"Source Serif Pro", "Iowan Old Style", "Palatino", "Georgia", serif',
        }}
      >
        Powered by Scryfall
      </a>
    </footer>
  );
}
