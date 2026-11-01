import { describe, expect, it } from "vitest";
import { auditSource, compareBaseline, countFindings } from "./copy-audit";

const scan = (source: string) => auditSource("src/example.tsx", source);

describe("copy migration guard", () => {
  it("finds JSX, accessible names, dynamic alternatives, labels and notifications", () => {
    const findings = scan(`
      const action = { label: "Reset deck", message: "Are you sure?" };
      toast.error("Unable to leave.");
      toast("Room created.");
      setMessage("Try again.");
      const view = <button aria-label={busy ? "Starting" : "Start"} title="Play">
        Play together {busy ? "Please wait" : "Ready"}
        {count > 0 && \`Draw \${count} cards\`}
      </button>;
    `);
    expect(findings.map(({ text }) => text)).toEqual(expect.arrayContaining([
      "Reset deck", "Are you sure?", "Unable to leave.", "Room created.", "Try again.",
      "Starting", "Start", "Play", "Play together", "Please wait", "Ready", "Draw ${count} cards",
    ]));
    expect(findings).toHaveLength(12);
  });

  it("does not treat styling, discriminants, URLs, code, or translated calls as copy", () => {
    expect(scan(`
      import { m } from "@/paraglide/messages";
      const state = "starting";
      const view = <button className={state === "starting" ? "text-red-500" : "text-white"}
        aria-label={m.start_game()} data-testid="Start game" href="/rooms">
        {state === "starting" ? m.starting_game() : m.start_game()}
        {42}{" "}{"…"}
      </button>;
      console.error("Diagnostic only");
    `)).toEqual([]);
  });

  it("does not hide inline copy when a translation also occurs in a template", () => {
    expect(scan('const view = <p>{`Hello ${m.name()}`}</p>;')[0]?.text).toBe("Hello ${m.name()}");
  });

  it("keeps fingerprints stable when lines move", () => {
    expect(countFindings(scan('<p>Hello</p>'))).toEqual(countFindings(scan('\n\n<p>Hello</p>')));
  });

  it("rejects new text and extra occurrences of existing text", () => {
    const baseline = countFindings(scan('<p>Hello</p>'));
    const current = countFindings(scan('<><p>Hello</p><p>Hello</p><p>New copy</p></>'));
    expect(compareBaseline(current, baseline).added).toHaveLength(2);
  });

  it("requires pruning removed text so it cannot silently return later", () => {
    const original = countFindings(scan('<p>Hello</p>'));
    const migrated = countFindings(scan('<p>{m.hello()}</p>'));
    expect(compareBaseline(migrated, original).removed).toHaveLength(1);
    expect(compareBaseline(original, migrated).added).toHaveLength(1);
  });
});
