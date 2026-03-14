import { fireEvent, render } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Card, Player, Zone } from "@/types";
import { CardPreviewProvider } from "../../card/CardPreviewProvider";
import { SeatView } from "../SeatView";
import { getLgMediaQuery } from "@/hooks/game/seat/useSeatSizing";

const setMatchMedia = (matches: boolean) => {
  const lgQuery = getLgMediaQuery();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === lgQuery ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const makePlayer = (overrides: Partial<Player> = {}): Player =>
  ({
    id: "p1",
    name: "Player One",
    life: 40,
    counters: [],
    commanderDamage: {},
    commanderTax: 0,
    deckLoaded: true,
    ...overrides,
  }) as Player;

const makeZone = (
  id: string,
  type: Zone["type"],
  cardIds: string[] = [],
  ownerId = "p1",
): Zone =>
  ({
    id,
    ownerId,
    type,
    cardIds,
  }) as Zone;

const makeCard = (id: string, zoneId: string, name: string): Card =>
  ({
    id,
    name,
    ownerId: "p1",
    controllerId: "p1",
    zoneId,
    tapped: false,
    faceDown: false,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
    counters: [],
  }) as Card;

describe("SeatView desktop side-zone previews", () => {
  beforeEach(() => {
    setMatchMedia(true);
  });

  it("shows previews on hover for graveyard, exile, and revealed top library cards", () => {
    const libraryZone = makeZone("library-p1", "library", ["c-library"]);
    const graveyardZone = makeZone("graveyard-p1", "graveyard", ["c-graveyard"]);
    const exileZone = makeZone("exile-p1", "exile", ["c-exile"]);
    const libraryCard = makeCard("c-library", libraryZone.id, "Library Card");
    const graveyardCard = makeCard("c-graveyard", graveyardZone.id, "Graveyard Card");
    const exileCard = makeCard("c-exile", exileZone.id, "Exile Card");

    const model = {
      isTop: false,
      isRight: false,
      mirrorBattlefieldY: false,
      inverseScalePercent: 100,
      zones: {
        library: libraryZone,
        graveyard: graveyardZone,
        exile: exileZone,
      },
      cards: {
        library: [libraryCard],
        graveyard: [graveyardCard],
        exile: [exileCard],
        battlefield: [],
        commander: [],
        hand: [],
      },
      opponentLibraryRevealCount: 0,
    } as const;

    const { container } = render(
      <CardPreviewProvider>
        <DndContext>
          <SeatView
            player={makePlayer({
              deckLoaded: true,
              libraryCount: 1,
              libraryTopReveal: { to: ["p1"] },
            })}
            color="sky"
            isMe
            viewerPlayerId="p1"
            opponentColors={{ p1: "sky" }}
            model={model as any}
          />
        </DndContext>
      </CardPreviewProvider>,
    );

    const hoverZone = (zoneId: string) => {
      const zone = container.querySelector(`[data-zone-id="${zoneId}"]`);
      if (!(zone instanceof HTMLElement)) {
        throw new Error(`Expected zone ${zoneId}`);
      }
      fireEvent.mouseEnter(zone);
      expect(container.querySelector("[data-card-preview]")).not.toBeNull();
      fireEvent.mouseLeave(zone);
      expect(container.querySelector("[data-card-preview]")).toBeNull();
    };

    hoverZone(libraryZone.id);
    hoverZone(graveyardZone.id);
    hoverZone(exileZone.id);
  });

  it("closes the active side-zone preview after the hovered top card changes", () => {
    const graveyardZone = makeZone("graveyard-p1", "graveyard", ["c-graveyard-1"]);
    const firstCard = makeCard("c-graveyard-1", graveyardZone.id, "First Card");
    const secondCard = makeCard("c-graveyard-2", graveyardZone.id, "Second Card");

    const buildModel = (card: Card) =>
      ({
        isTop: false,
        isRight: false,
        mirrorBattlefieldY: false,
        inverseScalePercent: 100,
        zones: {
          graveyard: graveyardZone,
        },
        cards: {
          library: [],
          graveyard: [card],
          exile: [],
          battlefield: [],
          commander: [],
          hand: [],
        },
        opponentLibraryRevealCount: 0,
      }) as const;

    const { container, rerender } = render(
      <CardPreviewProvider>
        <DndContext>
          <SeatView
            player={makePlayer()}
            color="sky"
            isMe
            viewerPlayerId="p1"
            opponentColors={{ p1: "sky" }}
            model={buildModel(firstCard) as any}
          />
        </DndContext>
      </CardPreviewProvider>,
    );

    const zone = container.querySelector(`[data-zone-id="${graveyardZone.id}"]`);
    if (!(zone instanceof HTMLElement)) {
      throw new Error(`Expected zone ${graveyardZone.id}`);
    }

    fireEvent.mouseEnter(zone);
    expect(container.querySelector("[data-card-preview]")).not.toBeNull();

    rerender(
      <CardPreviewProvider>
        <DndContext>
          <SeatView
            player={makePlayer()}
            color="sky"
            isMe
            viewerPlayerId="p1"
            opponentColors={{ p1: "sky" }}
            model={buildModel(secondCard) as any}
          />
        </DndContext>
      </CardPreviewProvider>,
    );

    fireEvent.mouseLeave(zone);
    expect(container.querySelector("[data-card-preview]")).toBeNull();
  });
});
