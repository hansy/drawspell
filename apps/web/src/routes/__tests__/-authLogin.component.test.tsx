import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/landing/SiteLayout", () => ({
  SiteLayout: ({ children }: { children: React.ReactNode }) => children,
}));

import { LoginPage } from "../auth.login";

afterEach(() => vi.unstubAllGlobals());

describe("sign-in request state", () => {
  it("disables submission while pending and restores the CTA after completion", async () => {
    let finish: ((response: Response) => void) | undefined;
    const pending = new Promise<Response>(resolve => { finish = resolve; });
    const request = vi.fn(() => pending);
    vi.stubGlobal("fetch", request);
    render(<LoginPage />);
    const email = screen.getByRole("textbox", { name: "Email" });
    fireEvent.change(email, { target: { value: "test@example.test" } });
    const button = screen.getByRole("button", { name: "Send sign-in link" });
    fireEvent.click(button);
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("button", { name: "Sending sign-in link" })).toBe(button);
    const form = button.closest("form");
    if (!form || !finish) throw new Error("Missing pending sign-in form");
    fireEvent.submit(form);
    expect(request).toHaveBeenCalledTimes(1);
    finish(new Response("{}", { status: 200 }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Check your email"));
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-label")).toBe("Send sign-in link");
  });
});
