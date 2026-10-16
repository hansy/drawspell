export const landingContent = {
  badge: "No downloads - No login",
  title: "Just Magic",
  description: "Drawspell is a web-based virtual tabletop simulator for playing Magic: The Gathering. Create a room, share with friends, and play together.",
};

export const publicPages = [
  { path: "/", markdown: "/index.md", title: "Drawspell", description: "Virtual tabletop for Magic: The Gathering." },
  { path: "/docs", markdown: "/docs.md", title: "Drawspell API", description: "Authentication, room creation, request examples, responses, retries, and errors." },
  { path: "/privacy", markdown: "/privacy.md", title: "Privacy Policy", description: "Data collection, usage, sharing, retention, and contact information." },
  { path: "/tos", markdown: "/tos.md", title: "Terms of Service", description: "Terms for using the hosted Drawspell service." },
];

export function agentDiscoveryLinks(path: string) {
  const page = publicPages.find(page => page.path === path);
  return page ? [
    { rel: "alternate", type: "text/markdown", href: page.markdown, title: "Markdown" },
    { rel: "describedby", href: "/llms.txt", type: "text/plain" },
  ] : [];
}
