import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/landing/SiteLayout", () => ({
  SiteLayout: ({ children }: { children: React.ReactNode }) => children,
}));

import { ApiDocs } from "../docs";

afterEach(() => vi.unstubAllGlobals());

describe("docs navigation drawer", () => {
  it("closes after navigation and restores focus when dismissed with Escape", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    render(<ApiDocs />);
    const target = document.getElementById("authentication");
    if (!target) throw new Error("Missing authentication section");
    const scroll = vi.fn();
    target.scrollIntoView = scroll;
    expect(screen.queryByRole("link", { name: "Get API key" })).toBeNull();
    const trigger = screen.getByRole("button", { name: "Table of contents" });
    fireEvent.click(trigger);
    const drawer = screen.getByRole("dialog", { name: "Table of contents" });
    const link = within(drawer).getByRole("link", { name: "Authentication" });
    expect(link.getAttribute("href")).toBe("#authentication");
    fireEvent.click(link);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(target));
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(window.location.hash).toBe("#authentication");
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});
