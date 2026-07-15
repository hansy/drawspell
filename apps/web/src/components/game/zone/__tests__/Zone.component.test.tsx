import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ZONE } from "@/constants/zones";
import { useGameStore } from "@/store/gameStore";
import { Zone } from "../Zone";

vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useDndContext: () => ({
    active: { id: "c1", data: { current: { cardId: "c1" } } },
    over: {
      id: "gy1",
      data: { current: { cardId: "gy1", zoneId: "p1-graveyard" } },
    },
  }),
}));

describe("Zone drop feedback", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState({
        myPlayerId: "p1",
        viewerRole: "player",
        cards: {
          c1: {
            id: "c1",
            name: "Dragged card",
            ownerId: "p1",
            controllerId: "p1",
            zoneId: "p1-battlefield",
            tapped: false,
            faceDown: false,
            position: { x: 0.5, y: 0.5 },
            rotation: 0,
            counters: [],
          },
        },
        zones: {
          "p1-battlefield": {
            id: "p1-battlefield",
            type: ZONE.BATTLEFIELD,
            ownerId: "p1",
            cardIds: ["c1"],
          },
        },
      } as any);
    });
  });

  it("renders drop feedback above occupied zone content", () => {
    const zone = {
      id: "p1-graveyard",
      type: ZONE.GRAVEYARD,
      ownerId: "p1",
      cardIds: ["gy1"],
    } as any;
    const { container } = render(
      <Zone zone={zone} className="bg-zinc-900/25 overflow-hidden">
        <div data-occupied-card className="absolute inset-0 bg-black" />
      </Zone>,
    );

    const highlight = container.querySelector("[data-zone-drop-highlight]");
    expect(highlight).not.toBeNull();
    expect(highlight?.classList.contains("z-50")).toBe(true);
  });
});
