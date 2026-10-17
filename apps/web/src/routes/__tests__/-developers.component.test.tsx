import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { invalidate } = vi.hoisted(() => ({ invalidate: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tanstack/react-router", async (original) => ({
  ...await original<typeof import("@tanstack/react-router")>(),
  useRouter: () => ({ invalidate }),
}));
import { DeveloperDashboard } from "../developers";

const keys = [{ id: "test-key", name: "Test key", prefix: "drawspell_test", createdAt: "2026-10-16T00:00:00.000Z", status: "active" as const }];
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("key deletion", () => {
  it("shows progress on the selected key, prevents duplicates, and refreshes after success", async () => {
    let finish: ((response: Response) => void) | undefined;
    const request = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", request);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    const view = render(<DeveloperDashboard keys={keys} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Test key" }));
    const deleting = screen.getByRole("button", { name: "Deleting Test key" });
    expect(deleting.hasAttribute("disabled")).toBe(true);
    expect(within(screen.getByRole("listitem")).getByText("Deleting…")).toBeTruthy();
    fireEvent.click(deleting);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]).toEqual(["/api/auth/developer/keys/test-key", expect.objectContaining({ method: "DELETE" })]);
    if (!finish) throw new Error("Missing pending deletion");
    finish(Response.json({ success: true }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
    view.rerender(<DeveloperDashboard keys={[]} />);
    expect(screen.queryByText("Test key")).toBeNull();
  });

  it("keeps the key and restores its action when deletion fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { message: "Please retry." } }, { status: 503 })));
    render(<DeveloperDashboard keys={keys} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Test key" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Please retry."));
    expect(screen.getByRole("button", { name: "Delete Test key" }).hasAttribute("disabled")).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
  });
});


describe("key creation dialog", () => {
  it("asks for a name in the dialog and shows the secret in the same dialog after creation", async () => {
    let finish: ((response: Response) => void) | undefined;
    const request = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", request);
    render(<DeveloperDashboard keys={[]} />);
    expect(screen.queryByRole("textbox", { name: "Key name" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const dialog = screen.getByRole("dialog", { name: "Create API key" });
    const name = within(dialog).getByRole("textbox", { name: "Key name" });
    fireEvent.change(name, { target: { value: "My app" } });
    const create = within(dialog).getByRole("button", { name: "Create key" });
    fireEvent.click(create);
    expect(create.hasAttribute("disabled")).toBe(true);
    expect(create.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(create);
    expect(request).toHaveBeenCalledTimes(1);
    if (!finish) throw new Error("Missing pending creation");
    finish(Response.json({ key: "drawspell_test_secret" }, { status: 201 }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Your API key" })).toBe(dialog));
    const secret = within(dialog).getByRole("textbox", { name: "API key" });
    expect(secret.getAttribute("value")).toBe("drawspell_test_secret");
    expect(within(dialog).queryByRole("textbox", { name: "Key name" })).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Copy API key" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
