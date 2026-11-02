import { m } from "@/paraglide/messages.js";
export const landingContent = {
  get badge() { return m.public_pages_no_downloads_no_login(); },
  get title() { return m.public_pages_just_magic(); },
  get description() { return m.public_pages_drawspell_is_a_web_based_virtual_tabletop_simulator_for_playing_m(); },
};

export const publicPages = [
  { path: "/", markdown: "/index.md", get title() { return m.site_header_drawspell(); }, get description() { return m.public_pages_virtual_tabletop_for_magic_the_gathering(); } },
  { path: "/docs", markdown: "/docs.md", get title() { return m.public_pages_drawspell_api(); }, get description() { return m.public_pages_authentication_room_creation_request_examples_responses_retries_a(); } },
  { path: "/privacy", markdown: "/privacy.md", get title() { return m.public_pages_privacy_policy(); }, get description() { return m.public_pages_data_collection_usage_sharing_retention_and_contact_information(); } },
  { path: "/tos", markdown: "/tos.md", get title() { return m.public_pages_terms_of_service(); }, get description() { return m.public_pages_terms_for_using_the_hosted_drawspell_service(); } },
];

export function agentDiscoveryLinks(path: string) {
  const page = publicPages.find(page => page.path === path);
  return page ? [
    { rel: "alternate", type: "text/markdown", href: page.markdown, title: m.public_pages_markdown() },
    { rel: "describedby", href: "/llms.txt", type: "text/plain" },
  ] : [];
}
