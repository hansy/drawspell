import { richText, messageSlot } from "@/i18n/richText";
import { localeHref } from "@/i18n/navigation";
import { m } from "@/paraglide/messages.js";
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
      { title: m.docs_api_documentation_drawspell() },
      { name: "description", content: m.docs_drawspell_api_authentication_room_creation_examples_limits_and_er() },
    ],
  }),
});

// Each endpoint owns its request, response, examples, and operational details.
const resources = [
  { get label() { return m.docs_rooms(); }, endpoints: [
    { id: "create-room", get title() { return m.create_room_docs_create_a_room(); }, method: "POST", Component: CreateRoomDocs },
  ] },
];

const sections = [
  { id: "overview", get title() { return m.docs_overview(); } },
  { id: "authentication", get title() { return m.docs_authentication(); } },
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
    <nav className="api-toc" aria-label={m.docs_api_documentation()}>
      <div>
        <h2>{m.docs_getting_started()}</h2>
        <a {...linkProps("overview")}>{m.docs_overview()}</a>
        <a {...linkProps("authentication")}>{m.docs_authentication()}</a>
      </div>
      {resources.map(resource => <div key={resource.label}>
        <h2>{resource.label}</h2>
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
  const activeTitle = sections.find(section => section.id === activeId)?.title ?? m.docs_overview();

  return (
    <SiteLayout>
    <div className="api-docs">
      <div className="api-layout">
        <div className="api-sidebar"><DocsTableOfContents activeId={activeId} onNavigate={onNavigate} /></div>
        <div className="api-mobile-toc">
          <Dialog.Root open={tocOpen} onOpenChange={setTocOpen}>
            <Dialog.Trigger asChild>
              <button ref={tocTrigger} type="button" className="api-toc-trigger" aria-label={m.docs_table_of_contents()}>
                <List size={17} aria-hidden="true" />
                <span>{m.docs_api_reference()}<span className="api-toc-divider">/</span><strong>{activeTitle}</strong></span>
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
                  <div><span>{m.site_header_drawspell()}</span><Dialog.Title>{m.docs_table_of_contents()}</Dialog.Title></div>
                  <Dialog.Close className="api-toc-close" aria-label={m.docs_close_table_of_contents()}><X size={18} /></Dialog.Close>
                </div>
                <DocsTableOfContents activeId={activeId} onNavigate={onNavigate} />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
        <main className="api-content">
          <div className="api-heading" id="overview" tabIndex={-1}>
            <div><h1>{m.public_pages_drawspell_api()}</h1><p>{m.docs_connect_your_app_to_drawspell()}</p></div>
          </div>
          <div className="api-base-url"><span>{m.docs_base_url()}</span><code>https://drawspell.space/api/v1</code></div>
          <section id="authentication" tabIndex={-1} className="api-section api-pair" aria-labelledby="authentication-title">
            <div>
              <h2 id="authentication-title">{m.docs_authentication()}</h2>
              <p>{richText(m.rich_docs_and_create_an_api_key_in_your_dashboard({ a_0: messageSlot("a_0") }), { a_0: (<a href={localeHref("/developers")}>{m.docs_sign_into_the_developer_portal()}</a>) })}</p>
              <p>{richText(m.rich_docs_send_it_in_the_header_with_every_api_request({ code_0: messageSlot("code_0") }), { code_0: (<code>{m.docs_authorization()}</code>) })}</p>
            </div>
            <div className="api-auth-details">
              <pre aria-label={m.docs_authorization_header()}><code><span>{m.docs_authorization_2()}</span> {m.docs_bearer_your_api_key()}</code></pre>
              <p>{richText(m.rich_docs_manage_up_to_five_active_keys_in({ a_0: messageSlot("a_0") }), { a_0: (<a href={localeHref("/developers")}>{m.docs_your_dashboard()}</a>) })}</p>
              <p>{richText(m.rich_docs_missing_invalid_or_revoked_keys_return_disabled_account({ code_0: messageSlot("code_0"), code_1: messageSlot("code_1") }), { code_0: (<code>{m.docs_401_unauthorized()}</code>), code_1: (<code>{m.docs_403_forbidden()}</code>) })}</p>
            </div>
          </section>
          {resources.flatMap(resource => resource.endpoints.map(({ id, Component }) => <Component key={id} />))}
        </main>
      </div>
    </div>
    </SiteLayout>
  );
}
