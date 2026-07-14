import { DndContext } from "@dnd-kit/core";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ZONE } from "@/constants/zones";
import { useDragStore } from "@/store/dragStore";
import { useGameStore } from "@/store/gameStore";
import { useSelectionStore } from "@/store/selectionStore";
import type { Card, Player, Zone } from "@/types";
import { CardPreviewProvider } from "../../card/CardPreviewProvider";
import { Battlefield } from "../Battlefield";

const buildZone = (id: string, ownerId: string, cardIds: string[] = []): Zone => ({
  id,
  type: ZONE.BATTLEFIELD,
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
  position: { x: 0.25, y: 0.25 },
  rotation: 0,
  counters: [],
});

const buildPlayer = (id: string): Player => ({
  id,
  name: "Player",
  life: 20,
  counters: [],
  commanderDamage: {},
  commanderTax: 0,
});

describe("Battlefield ghost rendering", () => {
  beforeEach(() => {
    useGameStore.setState({
      zones: {},
      cards: {},
      players: {},
      myPlayerId: "p1",
      viewerRole: "player",
    });
    useSelectionStore.setState({ selectedCardIds: [], selectionZoneId: null });
    useDragStore.setState({
      ghostCards: null,
      activeCardId: null,
      isGroupDragging: false,
      overCardScale: 1,
      pendingDropVisualClaims: [],
    });
  });

  it("renders a single battlefield ghost as the light blue rectangle drop target", () => {
    const zone = buildZone("p1-battlefield", "p1", ["c1"]);
    const card = buildCard("c1", zone.id);
    const player = buildPlayer("p1");

    useGameStore.setState({
      zones: { [zone.id]: zone },
      cards: { [card.id]: card },
      players: { [player.id]: player },
      myPlayerId: "p1",
      viewerRole: "player",
    });
    useDragStore.setState({
      ghostCards: [
        {
          cardId: card.id,
          zoneId: zone.id,
          position: { x: 200, y: 150 },
          tapped: false,
        },
      ],
    });

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Battlefield
            zone={zone}
            cards={[card]}
            player={player}
            isTop
            isMe
            viewerPlayerId="p1"
            viewerRole="player"
            mirrorBattlefieldY
            playerColors={{ p1: "sky" }}
          />
        </CardPreviewProvider>
      </DndContext>
    );

    const ghost = container.querySelector('[data-dnd-ghost-card-id="c1"]');
    const sourceCard = container.querySelector('[data-card-id="c1"]');

    expect(ghost).not.toBeNull();
    expect(ghost?.getAttribute("data-card-id")).toBeNull();
    expect(ghost?.getAttribute("data-dnd-ghost-kind")).toBe("single");
    expect(ghost?.querySelector(".border-cyan-200")).not.toBeNull();
    expect(ghost?.querySelector(".bg-cyan-300\\/25")).not.toBeNull();
    expect((sourceCard as HTMLElement | null)?.style.transform).toContain("rotate(180deg)");
  });

  it("keeps a battlefield source card visually suppressed while cross-zone drop ownership is pending", () => {
    const zone = buildZone("p1-battlefield", "p1", ["c1"]);
    const card = buildCard("c1", "p1-hand");
    const player = buildPlayer("p1");

    useGameStore.setState({
      zones: { [zone.id]: zone },
      cards: { [card.id]: card },
      players: { [player.id]: player },
      myPlayerId: "p1",
      viewerRole: "player",
    });
    useDragStore.setState({
      pendingDropVisualClaims: [
        {
          cardId: card.id,
          sourceZoneId: zone.id,
          targetZoneId: "p1-hand",
        },
      ],
    } as Partial<ReturnType<typeof useDragStore.getState>>);

    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <Battlefield
            zone={zone}
            cards={[card]}
            player={player}
            isTop={false}
            isMe
            viewerPlayerId="p1"
            viewerRole="player"
            mirrorBattlefieldY={false}
            playerColors={{ p1: "sky" }}
          />
        </CardPreviewProvider>
      </DndContext>
    );

    const sourceCard = container.querySelector('[data-card-id="c1"]');

    expect(sourceCard).not.toBeNull();
    expect(sourceCard?.classList.contains("opacity-0")).toBe(true);
  });
});
