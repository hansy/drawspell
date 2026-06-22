import { describe, expect, it, vi } from "vitest";

const flushSyncMock = vi.fn((callback: () => void) => callback());

vi.mock("react-dom", () => ({
  flushSync: (callback: () => void) => flushSyncMock(callback),
}));

describe("drag-frame commit contracts", () => {
  it("commits ghost store updates through a React flush on the next microtask", async () => {
    const { commitDragFrameStoreUpdate } = await import("../commit");
    const update = vi.fn();

    commitDragFrameStoreUpdate(update);

    expect(flushSyncMock).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();

    await Promise.resolve();

    expect(flushSyncMock).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
