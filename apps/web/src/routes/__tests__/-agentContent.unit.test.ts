import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { agentDiscoveryLinks, publicPages } from "@/content/publicPages";
import examples from "@/generated/doc-examples.json";

const read = (path: string) => readFileSync(`public/${path}`, "utf8");

describe("generated agent content", () => {
  it("connects every public page to its Markdown and includes it in the combined document", () => {
    const index = read("llms.txt");
    const full = read("llms-full.txt");
    for (const page of publicPages) {
      const content = read(page.markdown.slice(1));
      expect(index).toContain(`https://drawspell.space${page.markdown}`);
      expect(content).toContain(`# ${page.path === "/" ? "Just Magic" : page.title}`);
      expect(full).toContain(content);
      expect(agentDiscoveryLinks(page.path)).toContainEqual({
        rel: "alternate", type: "text/markdown", href: page.markdown, title: "Markdown",
      });
    }
  });

  it("preserves all examples, nested field paths, and collapsed error content", () => {
    const docs = read("docs.md");
    for (const example of examples) expect(docs).toContain(example.code);
    expect(docs).toContain("`players[].deck.decklist`");
    expect(docs).toContain("| 429 | `rate_limited` Wait for Retry-After seconds. |");
    expect(docs).not.toContain("Copy code");
    expect(docs).not.toContain("<script");
  });
});
