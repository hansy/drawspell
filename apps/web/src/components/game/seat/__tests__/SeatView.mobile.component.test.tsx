import { fireEvent, render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Card, Player, Zone } from "@/types";
import { requestCardPreviewLock } from "@/lib/cardPreviewLock";

import { CardPreviewProvider } from "../../card/CardPreviewProvider";
import { SeatView } from "../SeatView";

vi.mock("@/lib/cardPreviewLock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cardPreviewLock")>();
  return {
    ...actual,
    requestCardPreviewLock: vi.fn(),
  };
});

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

describe("SeatView mobile toolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const libraryZone = makeZone("library-p1", "library", ["c-library"]);
  const graveyardZone = makeZone("graveyard-p1", "graveyard", ["c-graveyard"]);
  const exileZone = makeZone("exile-p1", "exile", ["c-exile"]);
  const libraryCard = makeCard("c-library", libraryZone.id, "Library Card");
  const graveyardCard = makeCard("c-graveyard", graveyardZone.id, "Graveyard Card");
  const exileCard = makeCard("c-exile", exileZone.id, "Exile Card");

  const baseModel = {
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

  it("renders four equal tiles with desktop side-zone behavior on mobile", () => {
    const onDrawCard = vi.fn();
    const onViewZone = vi.fn();
    const { container } = render(
      <CardPreviewProvider>
        <DndContext>
          <SeatView
            player={makePlayer({ deckLoaded: true, libraryCount: 1 })}
            color="sky"
            isMe
            viewerPlayerId="p1"
            opponentColors={{ p1: "sky" }}
            model={baseModel as any}
            layoutVariant="portrait-viewport"
            onDrawCard={onDrawCard}
            onViewZone={onViewZone}
          />
        </DndContext>
      </CardPreviewProvider>,
    );

    const aspectTiles = Array.from(container.querySelectorAll("div,button")).filter(
      (element) =>
        typeof (element as HTMLElement).className === "string" &&
        (element as HTMLElement).className.includes("aspect-[3/2]"),
    );
    expect(aspectTiles).toHaveLength(4);
    expect(screen.getByText("Library")).not.toBeNull();
    expect(screen.getByText("Graveyard")).not.toBeNull();
    expect(screen.getByText("Exile")).not.toBeNull();
    expect(
      Array.from(container.querySelectorAll("div")).some((element) =>
        element.className.includes("mtg_card_back.jpeg"),
      ),
    ).toBe(true);

    fireEvent.doubleClick(screen.getByText("Library"));
    expect(onDrawCard).toHaveBeenCalledWith("p1");

    fireEvent.click(screen.getByText("Graveyard"));
    fireEvent.click(screen.getByText("Exile"));
    expect(onViewZone).toHaveBeenNthCalledWith(1, graveyardZone.id);
    expect(onViewZone).toHaveBeenNthCalledWith(2, exileZone.id);
  });

  it("shows the wide load-library CTA instead of zone strip for unloaded self seat", () => {
    const onLoadDeck = vi.fn();
    render(
      <CardPreviewProvider>
        <DndContext>
          <SeatView
            player={makePlayer({ deckLoaded: false })}
            color="sky"
            isMe
            viewerPlayerId="p1"
            opponentColors={{ p1: "sky" }}
            model={baseModel as any}
            layoutVariant="portrait-viewport"
            onLoadDeck={onLoadDeck}
          />
        </DndContext>
      </CardPreviewProvider>,
    );

    const button = screen.getByRole("button", { name: "Load Library" });
    fireEvent.click(button);
    expect(onLoadDeck).toHaveBeenCalled();
    expect(screen.queryByText("Library")).toBeNull();
  });

  it("shows card preview on single tap when the top library card is revealed", () => {
    const onDrawCard = vi.fn();
    render(
      <CardPreviewProvider>
        <DndContext>
          <SeatView
            player={makePlayer({
              deckLoaded: true,
              libraryCount: 1,
              libraryTopReveal: "self",
            })}
            color="sky"
            isMe
            viewerPlayerId="p1"
            opponentColors={{ p1: "sky" }}
            model={baseModel as any}
            layoutVariant="portrait-viewport"
            onDrawCard={onDrawCard}
          />
        </DndContext>
      </CardPreviewProvider>,
    );

    fireEvent.click(screen.getByText("Library"));

    expect(requestCardPreviewLock).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: libraryCard.id }),
    );
    fireEvent.doubleClick(screen.getByText("Library"));
    expect(onDrawCard).toHaveBeenCalledWith("p1");
  });

  it("opens opponent library zone on tap when there are no pending reveal cards", () => {
    const onViewZone = vi.fn();
    render(
      <CardPreviewProvider>
        <DndContext>
          <SeatView
            player={makePlayer({
              id: "p1",
              deckLoaded: true,
              libraryCount: 1,
            })}
            color="sky"
            isMe={false}
            viewerPlayerId="me"
            opponentColors={{ me: "rose", p1: "sky" }}
            model={baseModel as any}
            layoutVariant="portrait-viewport"
            onViewZone={onViewZone}
          />
        </DndContext>
      </CardPreviewProvider>,
    );

    fireEvent.click(screen.getByText("Library"));
    expect(onViewZone).toHaveBeenCalledWith(libraryZone.id);
  });

  it("prioritizes opponent reveal modal over zone viewer when reveal cards exist", () => {
    const onViewZone = vi.fn();
    const onOpponentLibraryReveals = vi.fn();
    render(
      <CardPreviewProvider>
        <DndContext>
          <SeatView
            player={makePlayer({
              id: "p1",
              deckLoaded: true,
              libraryCount: 1,
            })}
            color="sky"
            isMe={false}
            viewerPlayerId="me"
            opponentColors={{ me: "rose", p1: "sky" }}
            model={{ ...baseModel, opponentLibraryRevealCount: 2 } as any}
            layoutVariant="portrait-viewport"
            onViewZone={onViewZone}
            onOpponentLibraryReveals={onOpponentLibraryReveals}
          />
        </DndContext>
      </CardPreviewProvider>,
    );

    fireEvent.click(screen.getByText("Library"));
    expect(onOpponentLibraryReveals).toHaveBeenCalledWith(libraryZone.id);
    expect(onViewZone).not.toHaveBeenCalled();
  });
});
