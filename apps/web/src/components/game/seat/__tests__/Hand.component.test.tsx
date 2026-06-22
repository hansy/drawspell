import { DndContext } from "@dnd-kit/core";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ZONE } from "@/constants/zones";
import { useDragStore } from "@/store/dragStore";
import type { Card, Zone } from "@/types";
import { CardPreviewProvider } from "../../card/CardPreviewProvider";
import { Hand } from "../Hand";

const buildHandZone = (id: string, ownerId: string, cardIds: string[]): Zone => ({
  id,
  type: ZONE.HAND,
  ownerId,
  cardIds,
});

const buildCard = (id: string, zoneId: string): Card => ({
  id,
  name: "Test Card",
  ownerId: "p1",
  controllerId: "p1",
  zoneId,
  tapped: false,
  faceDown: false,
  position: { x: 0, y: 0 },
  rotation: 0,
  counters: [],
});

describe("Hand visual ownership", () => {
  beforeEach(() => {
    useDragStore.setState({
      ghostCards: null,
      activeCardId: null,
      isGroupDragging: false,
      overCardScale: 1,
      pendingDropVisualClaims: [],
    } as Partial<ReturnType<typeof useDragStore.getState>>);
  });

  it("keeps a source-zone card visually suppressed while drop ownership is pending", () => {
    const card = buildCard("c1", "p1-battlefield");
    const zone = buildHandZone("p1-hand", "p1", [card.id]);

    useDragStore.setState({
      pendingDropVisualClaims: [
        {
          cardId: card.id,
          sourceZoneId: "p1-hand",
          targetZoneId: "p1-battlefield",
        },
      ],
    } as Partial<ReturnType<typeof useDragStore.getState>>);

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Hand
            zone={zone}
            cards={[card]}
            isTop={false}
            isRight={false}
            isMe
            viewerPlayerId="p1"
            viewerRole="player"
            showLabel={false}
          />
        </CardPreviewProvider>
      </DndContext>
    );

    const sourceCard = container.querySelector(
      '[data-dnd-hand-sortable-card-id="c1"]'
    );

    expect(sourceCard).not.toBeNull();
    expect(sourceCard?.classList.contains("opacity-0")).toBe(true);
  });
});
