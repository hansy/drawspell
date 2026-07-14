import { fireEvent, render, screen } from "@testing-library/react";
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

  it("closes a side-zone preview when the preview target disappears", () => {
    const graveyardZone = makeZone("graveyard-p1", "graveyard", ["c-graveyard-1"]);
    const previewableCard = makeCard("c-graveyard-1", graveyardZone.id, "Previewable Card");
    const hiddenCard = {
      ...makeCard("c-graveyard-1", graveyardZone.id, "Hidden Card"),
      faceDown: true,
    } as Card;

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
            model={buildModel(previewableCard) as any}
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
            model={buildModel(hiddenCard) as any}
          />
        </DndContext>
      </CardPreviewProvider>,
    );

    expect(container.querySelector("[data-card-preview]")).toBeNull();
  });

  it("composes desktop zones as battlefield edge overlays", () => {
    const onEditUsername = vi.fn();
    const handZone = makeZone("hand-p1", "hand", ["c-hand"]);
    const libraryZone = makeZone("library-p1", "library", ["c-library"]);
    const graveyardZone = makeZone("graveyard-p1", "graveyard", ["c-graveyard"]);
    const exileZone = makeZone("exile-p1", "exile", ["c-exile"]);
    const battlefieldZone = makeZone("battlefield-p1", "battlefield");
    const commanderZone = makeZone("commander-p1", "commander", ["c-commander"]);
    const model = {
      isTop: false,
      isRight: false,
      mirrorBattlefieldY: false,
      inverseScalePercent: 100,
      zones: {
        hand: handZone,
        library: libraryZone,
        graveyard: graveyardZone,
        exile: exileZone,
        battlefield: battlefieldZone,
        commander: commanderZone,
      },
      cards: {
        hand: [makeCard("c-hand", handZone.id, "Hand Card")],
        library: [makeCard("c-library", libraryZone.id, "Library Card")],
        graveyard: [makeCard("c-graveyard", graveyardZone.id, "Graveyard Card")],
        exile: [makeCard("c-exile", exileZone.id, "Exile Card")],
        battlefield: [],
        commander: [
          {
            ...makeCard("c-commander", commanderZone.id, "Commander Card"),
            commanderTax: 2,
            isCommander: true,
          },
        ],
      },
      opponentLibraryRevealCount: 0,
    } as const;

    const { container } = render(
      <CardPreviewProvider>
        <DndContext>
          <SeatView
            player={makePlayer({ libraryCount: 1 })}
            color="sky"
            isMe
            viewerPlayerId="p1"
            opponentColors={{ p1: "sky" }}
            model={model as any}
            onEditUsername={onEditUsername}
          />
        </DndContext>
      </CardPreviewProvider>,
    );

    expect(container.querySelector("[data-desktop-seat-overlay]")).not.toBeNull();
    expect(container.querySelector(".ds-desktop-seat-container")).not.toBeNull();
    expect(container.querySelector("[data-desktop-life-overlay]")).toBeNull();
    expect(container.querySelector("[data-desktop-life-total]")?.textContent).toBe("40");
    expect(container.querySelector("[data-desktop-bottom-overlay]")).not.toBeNull();
    expect(container.querySelector("[data-desktop-side-column]")).not.toBeNull();
    expect(container.querySelector("[data-desktop-side-player-name]")?.textContent).toBe("Player One");
    expect(container.querySelector("[data-desktop-side-column]")?.classList.contains("flex-col")).toBe(true);
    expect(container.querySelector("[data-desktop-side-player-slot]")?.classList.contains("items-start")).toBe(true);
    expect(container.querySelector("[data-commander-zone-panel]")?.classList.contains("bottom-0")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Edit player name" }));
    expect(onEditUsername).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-hand-fit-cards="true"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-side-zone-variant="edge"]')).toHaveLength(3);
    expect(container.textContent).toContain("Hand - 1");
    expect(container.textContent).toContain("Library - 1");
    expect(container.textContent).toContain("Graveyard - 1");
    expect(container.textContent).toContain("Exile - 1");
  });

  it("anchors the zone rail and its dependent overlays to the top for top seats", () => {
    const handZone = makeZone("hand-p1", "hand");
    const libraryZone = makeZone("library-p1", "library");
    const graveyardZone = makeZone("graveyard-p1", "graveyard");
    const exileZone = makeZone("exile-p1", "exile");
    const commanderZone = makeZone("commander-p1", "commander");
    const model = {
      isTop: true,
      isRight: false,
      mirrorBattlefieldY: true,
      inverseScalePercent: 100,
      zones: {
        hand: handZone,
        library: libraryZone,
        graveyard: graveyardZone,
        exile: exileZone,
        commander: commanderZone,
      },
      cards: {
        hand: [],
        library: [],
        graveyard: [],
        exile: [],
        battlefield: [],
        commander: [],
      },
      opponentLibraryRevealCount: 0,
    } as const;

    const { container } = render(
      <CardPreviewProvider>
        <DndContext>
          <SeatView
            player={makePlayer()}
            color="violet"
            isMe={false}
            viewerPlayerId="viewer"
            opponentColors={{ p1: "violet", viewer: "sky" }}
            model={model as any}
          />
        </DndContext>
      </CardPreviewProvider>,
    );

    const rail = container.querySelector("[data-bottom-bar]");
    const seat = container.querySelector('[data-seat-edge="top"]');
    const life = container.querySelector("[data-desktop-life-total]");
    const sideColumn = container.querySelector("[data-desktop-side-column]");
    const commanderPanel = container.querySelector("[data-commander-zone-panel]");
    const overlay = container.querySelector("[data-desktop-bottom-overlay]");

    expect(seat).not.toBeNull();
    expect(rail?.classList.contains("top-0")).toBe(true);
    expect(rail?.classList.contains("bottom-0")).toBe(false);
    expect((life as HTMLElement | null)?.style.top).not.toBe("");
    expect((sideColumn as HTMLElement | null)?.style.top).not.toBe("");
    expect((sideColumn as HTMLElement | null)?.style.bottom).toBe("0px");
    expect(overlay?.classList.contains("rotate-180")).toBe(true);
    expect(sideColumn?.classList.contains("left-0")).toBe(true);
    expect(sideColumn?.classList.contains("flex-col-reverse")).toBe(true);
    expect(container.querySelector("[data-desktop-side-player-slot]")?.classList.contains("items-end")).toBe(true);
    expect(commanderPanel?.classList.contains("left-full")).toBe(true);
    expect(commanderPanel?.classList.contains("top-0")).toBe(true);
    expect(life?.classList.contains("rotate-180")).toBe(false);
    expect(container.querySelector("[data-desktop-hand-edge-glow]")).toBeNull();
    expect(
      Array.from(container.querySelectorAll("[data-edge-zone-label]")).every(
        (label) => label.classList.contains("rotate-180"),
      ),
    ).toBe(true);
  });
});
