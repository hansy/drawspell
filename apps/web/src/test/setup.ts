import { vi } from "vitest";

vi.mock("@/partykit/intentTransport", async () => {
  const actual = await vi.importActual<typeof import("@/partykit/intentTransport")>(
    "@/partykit/intentTransport"
  );
  return {
    ...actual,
    sendIntent: vi.fn(() => true),
  };
});
