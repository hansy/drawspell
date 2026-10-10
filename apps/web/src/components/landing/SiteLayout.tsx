import type { ReactNode } from "react";
import { FooterLinks } from "./FooterLinks";
import { SiteHeader } from "./SiteHeader";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#0b0a0f] text-zinc-100">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <FooterLinks />
    </div>
  );
}
