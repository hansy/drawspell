import { agentDiscoveryLinks } from "@/content/publicPages";
import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/landing/SiteLayout";
import { ChevronDown, List, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AnchorHTMLAttributes, MouseEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CreateRoomDocs } from "@/components/docs/CreateRoomDocs";
import "@/components/docs/docs.css";

export const Route = createFileRoute("/docs")({
  component: ApiDocs,
  head: () => ({
    links: agentDiscoveryLinks("/docs"),
    meta: [
      { title: "API documentation | Drawspell" },
      { name: "description", content: "Drawspell API authentication, room creation, examples, limits, and error reference." },
    ],
  }),
});

// Each endpoint owns its request, response, examples, and operational details.
const resources = [
  { name: "Rooms", endpoints: [
    { id: "create-room", title: "Create a room", method: "POST", Component: CreateRoomDocs },
  ] },
];

const sections = [
  { id: "overview", title: "Overview" },
  { id: "authentication", title: "Authentication" },
  ...resources.flatMap(resource => resource.endpoints),
];

function DocsTableOfContents({ activeId, onNavigate }: {
  activeId: string;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, id: string) => void;
}) {
  const linkProps = (id: string) => ({
    href: `#${id}`,
    "aria-current": activeId === id ? "location" : undefined,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => onNavigate(event, id),
  }) satisfies AnchorHTMLAttributes<HTMLAnchorElement>;
  return (
    <nav className="api-toc" aria-label="API documentation">
      <div>
        <h2>Getting started</h2>
        <a {...linkProps("overview")}>Overview</a>
        <a {...linkProps("authentication")}>Authentication</a>
      </div>
      {resources.map(resource => <div key={resource.name}>
        <h2>{resource.name}</h2>
        {resource.endpoints.map(endpoint => <a key={endpoint.id} {...linkProps(endpoint.id)}>
          <span className="api-nav-method">{endpoint.method}</span>{endpoint.title}
        </a>)}
      </div>)}
    </nav>
  );
}

function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`);
  // Focus must not restore the old scroll position before moving to the section.
  target.focus({ preventScroll: true });
  target.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    block: "start",
  });
}

export function ApiDocs() {
  const [tocOpen, setTocOpen] = useState(false);
  const [activeId, setActiveId] = useState("overview");
  const pendingSection = useRef<string | null>(null);
  const tocTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let frame = 0;
    const updateSection = () => {
      const current = [...sections].reverse().find(section => {
        const target = document.getElementById(section.id);
        return target && target.getBoundingClientRect().top <= 120;
      });
      setActiveId(current?.id ?? "overview");
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateSection);
    };
    updateSection();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const onNavigate = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (tocOpen) {
      pendingSection.current = id;
      setTocOpen(false);
    } else {
      scrollToSection(id);
    }
  };
  const activeTitle = sections.find(section => section.id === activeId)?.title ?? "Overview";

  return (
    <SiteLayout>
    <div className="api-docs">
      <div className="api-layout">
        <div className="api-sidebar"><DocsTableOfContents activeId={activeId} onNavigate={onNavigate} /></div>
        <div className="api-mobile-toc">
          <Dialog.Root open={tocOpen} onOpenChange={setTocOpen}>
            <Dialog.Trigger asChild>
              <button ref={tocTrigger} type="button" className="api-toc-trigger" aria-label="Table of contents">
                <List size={17} aria-hidden="true" />
                <span>API reference<span className="api-toc-divider">/</span><strong>{activeTitle}</strong></span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="api-toc-overlay" />
              <Dialog.Content className="api-toc-drawer" aria-describedby={undefined}
                onCloseAutoFocus={event => {
                  event.preventDefault();
                  const id = pendingSection.current;
                  if (!id) {
                    tocTrigger.current?.focus({ preventScroll: true });
                    return;
                  }
                  pendingSection.current = null;
                  // The exit animation and scroll lock have finished at this point.
                  requestAnimationFrame(() => scrollToSection(id));
                }}>
                <div className="api-toc-drawer-heading">
                  <div><span>Drawspell</span><Dialog.Title>Table of contents</Dialog.Title></div>
                  <Dialog.Close className="api-toc-close" aria-label="Close table of contents"><X size={18} /></Dialog.Close>
                </div>
                <DocsTableOfContents activeId={activeId} onNavigate={onNavigate} />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
        <main className="api-content">
          <div className="api-heading" id="overview" tabIndex={-1}>
            <div><h1>Drawspell API</h1><p>Connect your app to Drawspell.</p></div>
          </div>
          <div className="api-base-url"><span>Base URL</span><code>https://drawspell.space/api/v1</code></div>
          <section id="authentication" tabIndex={-1} className="api-section api-pair" aria-labelledby="authentication-title">
            <div>
              <h2 id="authentication-title">Authentication</h2>
              <p><a href="/developers">Sign into the developer portal</a> and create an API key in your dashboard.</p>
              <p>Send it in the <code>Authorization</code> header with every API request.</p>
            </div>
            <div className="api-auth-details">
              <pre aria-label="Authorization header"><code><span>Authorization:</span> Bearer YOUR_API_KEY</code></pre>
              <p>Manage up to five active keys in <a href="/developers">your dashboard</a>.</p>
              <p>Missing, invalid, or revoked keys return <code>401 unauthorized</code>. Disabled accounts or insufficient permissions return <code>403 forbidden</code>.</p>
            </div>
          </section>
          {resources.flatMap(resource => resource.endpoints.map(({ id, Component }) => <Component key={id} />))}
        </main>
      </div>
    </div>
    </SiteLayout>
  );
}
