import { describe, expect, it, vi } from "vitest";
import { ZONE, ZONE_LABEL } from "@/constants/zones";
import { Card, Player, PlayerId, Zone } from "@/types";
import {
  buildCardActions,
  buildGroupActions,
  buildZoneMoveActions,
  buildZoneViewActions,
} from "../menu";

const makeZone = (
  id: string,
  type: (typeof ZONE)[keyof typeof ZONE],
  ownerId: PlayerId
): Zone => ({
  id,
  type,
  ownerId,
  cardIds: [],
});

const baseCard: Card = {
  id: "c1",
  name: "Test",
  ownerId: "p1",
  controllerId: "p1",
  zoneId: "z1",
  tapped: false,
  faceDown: false,
  position: { x: 0, y: 0 },
  rotation: 0,
  counters: [],
};

const makePlayer = (id: PlayerId, name: string): Player => ({
  id,
  name,
  life: 40,
  counters: [],
  commanderDamage: {},
  commanderTax: 0,
});

describe("buildZoneMoveActions", () => {
  it("builds allowed moves between visible zones", () => {
    const current = makeZone("lib", ZONE.LIBRARY, "p1");
    const gy = makeZone("gy", ZONE.GRAVEYARD, "p1");
    const exile = makeZone("exile", ZONE.EXILE, "p1");
    const hand = makeZone("hand", ZONE.HAND, "p1");
    const battlefield = makeZone("bf", ZONE.BATTLEFIELD, "p1");
    const commander = makeZone("commander", ZONE.COMMANDER, "p1");
    const sideboard = makeZone("sideboard", ZONE.SIDEBOARD, "p1");
    const zones = {
      lib: current,
      gy,
      exile,
      hand,
      bf: battlefield,
      commander,
      sideboard,
    };

    const actions = buildZoneMoveActions(
      { ...baseCard, zoneId: current.id, ownerId: "p1", controllerId: "p1" },
      current,
      zones,
      "p1",
      vi.fn(),
      vi.fn(),
      undefined,
      undefined,
      "player"
    );

    const moveMenu = actions.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Move to..."
    );
    const labels =
      moveMenu?.submenu?.map((a) => (a.type === "action" ? a.label : "")) ?? [];
    expect(labels).toContain(ZONE_LABEL.graveyard);
    expect(labels).toContain(`${ZONE_LABEL.exile} ...`);
    expect(labels).toContain(ZONE_LABEL.hand);
    expect(labels).not.toContain(ZONE_LABEL.commander);
    expect(labels).not.toContain(ZONE_LABEL.sideboard);

    const battlefieldMenu = moveMenu?.submenu?.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === `${ZONE_LABEL.battlefield} ...`
    );
    const battlefieldLabels =
      battlefieldMenu?.submenu?.map((a) => (a.type === "action" ? a.label : "")) ?? [];
    expect(battlefieldLabels).toContain("Face up");
    expect(battlefieldLabels).toContain("Face down ...");

    const faceDownMenu = battlefieldMenu?.submenu?.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Face down ..."
    );
    const faceDownLabels =
      faceDownMenu?.submenu?.map((a) => (a.type === "action" ? a.label : "")) ?? [];
    expect(faceDownLabels).toContain("with morph (2/2)");
    expect(faceDownLabels).toContain("without morph");

    const exileMenu = moveMenu?.submenu?.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === `${ZONE_LABEL.exile} ...`,
    );
    expect(
      exileMenu?.submenu?.map((a) => (a.type === "action" ? a.label : "")),
    ).toEqual(["Face up", "Face down"]);

    const libraryMenu = moveMenu?.submenu?.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === `${ZONE_LABEL.library} ...`
    );
    const libraryLabels =
      libraryMenu?.submenu?.map((a) => (a.type === "action" ? a.label : "")) ?? [];
    expect(libraryLabels).toContain("Top");
    expect(libraryLabels).toContain("Bottom");
  });

  it("uses the same nested library placement menu for graveyard and exile", () => {
    const library = makeZone("lib", ZONE.LIBRARY, "p1");
    const graveyard = makeZone("gy", ZONE.GRAVEYARD, "p1");
    const exile = makeZone("exile", ZONE.EXILE, "p1");
    const zones = { lib: library, gy: graveyard, exile };

    const graveyardActions = buildZoneMoveActions(
      { ...baseCard, zoneId: graveyard.id, ownerId: "p1", controllerId: "p1" },
      graveyard,
      zones,
      "p1",
      vi.fn(),
      vi.fn(),
      undefined,
      undefined,
      "player"
    );
    const graveyardMoveMenu = graveyardActions.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Move to..."
    );
    const graveyardLibraryMenu = graveyardMoveMenu?.submenu?.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === `${ZONE_LABEL.library} ...`
    );
    const graveyardLibraryLabels =
      graveyardLibraryMenu?.submenu?.map((a) =>
        a.type === "action" ? a.label : ""
      ) ?? [];
    expect(graveyardLibraryLabels).toEqual(["Top", "Bottom"]);

    const exileActions = buildZoneMoveActions(
      { ...baseCard, zoneId: exile.id, ownerId: "p1", controllerId: "p1" },
      exile,
      zones,
      "p1",
      vi.fn(),
      vi.fn(),
      undefined,
      undefined,
      "player"
    );
    const exileMoveMenu = exileActions.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Move to..."
    );
    const exileLibraryMenu = exileMoveMenu?.submenu?.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === `${ZONE_LABEL.library} ...`
    );
    const exileLibraryLabels =
      exileLibraryMenu?.submenu?.map((a) =>
        a.type === "action" ? a.label : ""
      ) ?? [];
    expect(exileLibraryLabels).toEqual(["Top", "Bottom"]);
  });

  it("prompts for an exact position through the shared library move menu", () => {
    const library = makeZone("lib", ZONE.LIBRARY, "p1");
    const graveyard = makeZone("gy", ZONE.GRAVEYARD, "p1");
    const moveCard = vi.fn();
    const openCountPrompt = vi.fn();
    const players = {
      p1: { ...makePlayer("p1", "Owner"), libraryCount: 3 },
    };

    const actions = buildZoneMoveActions(
      { ...baseCard, zoneId: graveyard.id },
      graveyard,
      { [library.id]: library, [graveyard.id]: graveyard },
      "p1",
      moveCard,
      vi.fn(),
      players,
      undefined,
      "player",
      openCountPrompt,
    );
    const moveMenu = actions.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "Move to...",
    );
    const libraryMenu = moveMenu?.submenu?.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "Library ...",
    );
    const nth = libraryMenu?.submenu?.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "Nth from Top...",
    );

    nth?.onSelect();
    expect(openCountPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Move to Nth from Top",
        initialValue: 2,
        minValue: 1,
        maxValue: 4,
        confirmLabel: "Move card",
      }),
    );
    openCountPrompt.mock.calls[0]?.[0]?.onSubmit(3);
    expect(moveCard).toHaveBeenCalledWith(
      "c1",
      library.id,
      undefined,
      undefined,
      undefined,
      { libraryPositionFromTop: 3 },
    );
  });

  it("includes reveal submenu for owner in library", () => {
    const current = makeZone("lib", ZONE.LIBRARY, "p1");
    const gy = makeZone("gy", ZONE.GRAVEYARD, "p1");
    const zones = { lib: current, gy };
    const players = {
      p1: makePlayer("p1", "Owner"),
      p2: makePlayer("p2", "Alice"),
      p3: makePlayer("p3", "Bob"),
    };
    const setCardReveal = vi.fn();

    const actions = buildZoneMoveActions(
      {
        ...baseCard,
        zoneId: current.id,
        ownerId: "p1",
        controllerId: "p1",
        revealedToAll: false,
        revealedTo: ["p2"],
      },
      current,
      zones,
      "p1",
      vi.fn(),
      undefined,
      players,
      setCardReveal,
      "player"
    );

    const reveal = actions.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Reveal to ..."
    );
    expect(reveal?.submenu?.length).toBeGreaterThan(0);

    const revealToAll = reveal?.submenu?.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Reveal to all"
    );
    revealToAll?.onSelect();
    expect(setCardReveal).toHaveBeenCalledWith("c1", { toAll: true });

    const alice = reveal?.submenu?.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Alice"
    );
    alice?.onSelect();
    expect(setCardReveal).toHaveBeenCalledWith("c1", { to: [] });

    const hide = reveal?.submenu?.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Hide for all"
    );
    hide?.onSelect();
    expect(setCardReveal).toHaveBeenCalledWith("c1", null);
  });

  it("lets an authorized player manage every face-down exile viewer", () => {
    const exile = makeZone("exile", ZONE.EXILE, "p1");
    const players = {
      p1: makePlayer("p1", "Owner"),
      p2: makePlayer("p2", "Alice"),
      p3: makePlayer("p3", "Bob"),
    };
    const setCardReveal = vi.fn();
    const actions = buildZoneMoveActions(
      {
        ...baseCard,
        zoneId: exile.id,
        faceDown: true,
        revealedToAll: false,
        revealedTo: ["p1", "p2"],
      },
      exile,
      { [exile.id]: exile },
      "p1",
      vi.fn(),
      undefined,
      players,
      setCardReveal,
      "player",
    );

    const reveal = actions.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "Reveal to ...",
    );
    expect(
      reveal?.submenu?.filter((item) => item.type === "action").map((item) => ({
        label: item.label,
        checked: item.checked,
      })),
    ).toEqual([
      { label: "Everyone", checked: false },
      { label: "Me", checked: true },
      { label: "Alice", checked: true },
      { label: "Bob", checked: false },
      { label: "Hide from everyone", checked: undefined },
    ]);

    const bob = reveal?.submenu?.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "Bob",
    );
    bob?.onSelect();
    expect(setCardReveal).toHaveBeenCalledWith("c1", {
      to: ["p1", "p2", "p3"],
    });
  });

  it("lets the exile owner manage reveal controls for an unknown face-down card", () => {
    const exile = makeZone("exile", ZONE.EXILE, "p1");
    const actions = buildZoneMoveActions(
      { ...baseCard, zoneId: exile.id, faceDown: true, revealedTo: [] },
      exile,
      { [exile.id]: exile },
      "p1",
      vi.fn(),
      undefined,
      { p1: makePlayer("p1", "Owner") },
      vi.fn(),
      "player",
    );

    expect(
      actions.some(
        (item) => item.type === "action" && item.label === "Reveal to ...",
      ),
    ).toBe(true);
  });

  it("includes reveal submenu for controller on face-down battlefield cards", () => {
    const battlefield = makeZone("bf", ZONE.BATTLEFIELD, "p1");
    const zones = { bf: battlefield };
    const players = {
      p1: makePlayer("p1", "Controller"),
      p2: makePlayer("p2", "Alice"),
    };
    const setCardReveal = vi.fn();

    const actions = buildCardActions({
      card: {
        ...baseCard,
        zoneId: battlefield.id,
        ownerId: "p1",
        controllerId: "p1",
        faceDown: true,
        revealedToAll: false,
        revealedTo: [],
      },
      zones,
      players,
      myPlayerId: "p1",
      viewerRole: "player",
      moveCard: vi.fn(),
      moveCardToBottom: vi.fn(),
      tapCard: vi.fn(),
      transformCard: vi.fn(),
      duplicateCard: vi.fn(),
      createRelatedCard: vi.fn(),
      addCounter: vi.fn(),
      removeCounter: vi.fn(),
      openAddCounterModal: vi.fn(),
      globalCounters: {},
      setCardReveal,
    });

    const reveal = actions.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Reveal to ..."
    );
    expect(reveal?.submenu?.length).toBeGreaterThan(0);

    const revealToAll = reveal?.submenu?.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Reveal to all"
    );
    revealToAll?.onSelect();
    expect(setCardReveal).toHaveBeenCalledWith("c1", { toAll: true });
  });
});

describe("buildZoneViewActions", () => {
  it("offers Exile 1 and Exile Top X from the library", () => {
    const zone = makeZone("lib", ZONE.LIBRARY, "owner");
    const exileFromLibrary = vi.fn();
    const moveBottomLibraryCardToHand = vi.fn();
    const openCountPrompt = vi.fn();
    const items = buildZoneViewActions({
      zone,
      myPlayerId: "owner",
      viewerRole: "player",
      drawCard: vi.fn(),
      discardFromLibrary: vi.fn(),
      exileFromLibrary,
      moveBottomLibraryCardToHand,
      shuffleLibrary: vi.fn(),
      resetDeck: vi.fn(),
      mulligan: vi.fn(),
      unloadDeck: vi.fn(),
      players: {
        owner: { ...makePlayer("owner", "Owner"), libraryCount: 7 },
      },
      openCountPrompt,
    });

    const exileMenu = items.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "Exile ...",
    );
    const faceUpMenu = exileMenu?.submenu?.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "Face up ...",
    );
    const faceDownMenu = exileMenu?.submenu?.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "Face down ...",
    );
    const exileOne = faceUpMenu?.submenu?.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "Exile 1",
    );
    const exileTopX = faceUpMenu?.submenu?.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "Exile Top X...",
    );
    const exileOneFaceDown = faceDownMenu?.submenu?.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "Exile 1",
    );

    exileOne?.onSelect();
    expect(exileFromLibrary).toHaveBeenCalledWith("owner", 1, {
      faceDown: false,
    });

    exileTopX?.onSelect();
    expect(openCountPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Exile Top Cards",
        minValue: 1,
        maxValue: 7,
        showMaxButton: true,
        confirmLabel: "Exile",
      }),
    );
    const prompt = openCountPrompt.mock.calls[0]?.[0];
    prompt?.onSubmit(4);
    expect(exileFromLibrary).toHaveBeenCalledWith("owner", 4, {
      faceDown: false,
    });

    exileOneFaceDown?.onSelect();
    expect(exileFromLibrary).toHaveBeenCalledWith("owner", 1, {
      faceDown: true,
    });

    const bottomToHand = items.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "Put bottom card into hand",
    );
    bottomToHand?.onSelect();
    expect(moveBottomLibraryCardToHand).toHaveBeenCalledWith("owner");
  });

  it("disables count prompts when handler missing", () => {
    const zone = makeZone("lib", ZONE.LIBRARY, "owner");
    const items = buildZoneViewActions({
      zone,
      myPlayerId: "owner",
      viewerRole: "player",
      drawCard: vi.fn(),
      discardFromLibrary: vi.fn(),
      exileFromLibrary: vi.fn(),
      moveBottomLibraryCardToHand: vi.fn(),
      shuffleLibrary: vi.fn(),
      resetDeck: vi.fn(),
      mulligan: vi.fn(),
      unloadDeck: vi.fn(),
    });

    const drawMenu = items.find(
      (i): i is Extract<typeof i, { type: "action" }> =>
        i.type === "action" && i.label.includes("Draw ...")
    );
    const drawX = drawMenu?.submenu?.find(
      (i): i is Extract<typeof i, { type: "action" }> =>
        i.type === "action" && i.label.includes("Draw X")
    );
    expect(drawX?.disabledReason).toBeTruthy();

    const discardMenu = items.find(
      (i): i is Extract<typeof i, { type: "action" }> =>
        i.type === "action" && i.label.includes("Discard ...")
    );
    const discardX = discardMenu?.submenu?.find(
      (i): i is Extract<typeof i, { type: "action" }> =>
        i.type === "action" && i.label.includes("Discard X")
    );
    expect(discardX?.disabledReason).toBeTruthy();
  });

  it("enables count prompts when handler provided", () => {
    const zone = makeZone("lib", ZONE.LIBRARY, "owner");
    const openCountPrompt = vi.fn();
    const items = buildZoneViewActions({
      zone,
      myPlayerId: "owner",
      viewerRole: "player",
      drawCard: vi.fn(),
      discardFromLibrary: vi.fn(),
      exileFromLibrary: vi.fn(),
      moveBottomLibraryCardToHand: vi.fn(),
      shuffleLibrary: vi.fn(),
      resetDeck: vi.fn(),
      mulligan: vi.fn(),
      unloadDeck: vi.fn(),
      openCountPrompt,
    });

    const drawMenu = items.find(
      (i): i is Extract<typeof i, { type: "action" }> =>
        i.type === "action" && i.label.includes("Draw ...")
    );
    const drawX = drawMenu?.submenu?.find(
      (i): i is Extract<typeof i, { type: "action" }> =>
        i.type === "action" && i.label.includes("Draw X")
    );
    expect(drawX?.disabledReason).toBeUndefined();

    const discardMenu = items.find(
      (i): i is Extract<typeof i, { type: "action" }> =>
        i.type === "action" && i.label.includes("Discard ...")
    );
    const discardX = discardMenu?.submenu?.find(
      (i): i is Extract<typeof i, { type: "action" }> =>
        i.type === "action" && i.label.includes("Discard X")
    );
    expect(discardX?.disabledReason).toBeUndefined();
  });

  it("builds checkbox-style top card reveal controls", () => {
    const zone = makeZone("lib", ZONE.LIBRARY, "owner");
    const setLibraryTopReveal = vi.fn();
    const players = {
      owner: makePlayer("owner", "Owner"),
      p2: makePlayer("p2", "Alice"),
      p3: makePlayer("p3", "Bob"),
    };
    const items = buildZoneViewActions({
      zone,
      myPlayerId: "owner",
      viewerRole: "player",
      drawCard: vi.fn(),
      discardFromLibrary: vi.fn(),
      exileFromLibrary: vi.fn(),
      moveBottomLibraryCardToHand: vi.fn(),
      shuffleLibrary: vi.fn(),
      resetDeck: vi.fn(),
      mulligan: vi.fn(),
      unloadDeck: vi.fn(),
      players,
      libraryTopReveal: { to: ["p2"] },
      setLibraryTopReveal,
    });

    const revealMenu = items.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "Top card reveal ..."
    );
    expect(revealMenu?.submenu).toBeTruthy();

    const revealToSelf = revealMenu?.submenu?.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "To me"
    );
    expect(revealToSelf?.checked).toBe(false);
    revealToSelf?.onSelect();
    expect(setLibraryTopReveal).toHaveBeenCalledWith({ to: ["p2", "owner"] });

    const revealToAlice = revealMenu?.submenu?.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "To Alice"
    );
    expect(revealToAlice?.checked).toBe(true);
    revealToAlice?.onSelect();
    expect(setLibraryTopReveal).toHaveBeenCalledWith(null);

    const revealToAll = revealMenu?.submenu?.find(
      (item): item is Extract<typeof item, { type: "action" }> =>
        item.type === "action" && item.label === "To all players"
    );
    expect(revealToAll?.checked).toBe(false);
    revealToAll?.onSelect();
    expect(setLibraryTopReveal).toHaveBeenCalledWith({ toAll: true });
  });
});

describe("buildGroupActions", () => {
  it("builds the restricted Hand group menu", () => {
    const hand = makeZone("hand", ZONE.HAND, "p1");
    const battlefield = makeZone("bf", ZONE.BATTLEFIELD, "p1");
    const graveyard = makeZone("gy", ZONE.GRAVEYARD, "p1");
    const exile = makeZone("exile", ZONE.EXILE, "p1");
    const library = makeZone("lib", ZONE.LIBRARY, "p1");
    const commander = makeZone("commander", ZONE.COMMANDER, "p1");
    const sideboard = makeZone("sideboard", ZONE.SIDEBOARD, "p1");
    const cards = [
      { ...baseCard, id: "c1", zoneId: hand.id },
      { ...baseCard, id: "c2", zoneId: hand.id },
    ];
    hand.cardIds = cards.map((card) => card.id);
    const moveCards = vi.fn();
    const setCardsReveal = vi.fn();

    const actions = buildGroupActions({
      cards,
      currentZone: hand,
      zones: {
        [hand.id]: hand,
        [battlefield.id]: battlefield,
        [graveyard.id]: graveyard,
        [exile.id]: exile,
        [library.id]: library,
        [commander.id]: commander,
        [sideboard.id]: sideboard,
      },
      players: {
        p1: makePlayer("p1", "Player One"),
        p2: makePlayer("p2", "Player Two"),
      },
      myPlayerId: "p1",
      viewerRole: "player",
      moveCards,
      setCardsReveal,
    });

    expect(
      actions.map((item) => (item.type === "action" ? item.label : "")),
    ).toEqual(["Reveal to...", "Move to..."]);

    const revealMenu = actions[0];
    expect(revealMenu.type).toBe("action");
    if (revealMenu.type !== "action") return;
    expect(
      revealMenu.submenu
        ?.filter((item) => item.type === "action")
        .map((item) => item.label),
    ).toEqual(["Everyone", "Player Two", "Hide from everyone"]);

    const moveMenu = actions[1];
    expect(moveMenu.type).toBe("action");
    if (moveMenu.type !== "action") return;
    const moveLabels = moveMenu.submenu
      ?.filter((item) => item.type === "action")
      .map((item) => item.label);
    expect(moveLabels).toEqual([
      "Battlefield...",
      "Graveyard",
      "Exile...",
      "Library...",
    ]);
    expect(moveLabels).not.toContain("Commander");
    expect(moveLabels).not.toContain("Sideboard");

    const libraryMenu = moveMenu.submenu?.find(
      (item) => item.type === "action" && item.label === "Library...",
    );
    expect(libraryMenu?.type).toBe("action");
    if (!libraryMenu || libraryMenu.type !== "action") return;
    expect(
      libraryMenu.submenu?.map((item) =>
        item.type === "action" ? item.label : "",
      ),
    ).toEqual(["Bottom in random order"]);
    const randomBottom = libraryMenu.submenu?.[0];
    if (!randomBottom || randomBottom.type !== "action") return;
    randomBottom.onSelect();
    expect(moveCards).toHaveBeenCalledTimes(1);
    expect(moveCards.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        {
          cardId: "c1",
          toZoneId: library.id,
          placement: "bottom",
          opts: { random: true },
        },
        {
          cardId: "c2",
          toZoneId: library.id,
          placement: "bottom",
          opts: { random: true },
        },
      ]),
    );
  });

  it("builds the restricted move menu for a graveyard group", () => {
    const hand = makeZone("hand", ZONE.HAND, "p1");
    const battlefield = makeZone("bf", ZONE.BATTLEFIELD, "p1");
    const graveyard = makeZone("gy", ZONE.GRAVEYARD, "p1");
    const exile = makeZone("exile", ZONE.EXILE, "p1");
    const library = makeZone("lib", ZONE.LIBRARY, "p1");
    const moveCards = vi.fn();
    const setCardsReveal = vi.fn();
    const params = {
      cards: [
        { ...baseCard, id: "c1", zoneId: graveyard.id },
        { ...baseCard, id: "c2", zoneId: graveyard.id },
      ],
      currentZone: graveyard,
      zones: {
        [hand.id]: hand,
        [battlefield.id]: battlefield,
        [graveyard.id]: graveyard,
        [exile.id]: exile,
        [library.id]: library,
      },
      myPlayerId: "p1",
      viewerRole: "player" as const,
      moveCards,
      setCardsReveal,
    };
    const actions = buildGroupActions(params);
    expect(
      actions.map((item) => (item.type === "action" ? item.label : "")),
    ).toEqual(["Move to..."]);
    const moveMenu = actions[0];
    expect(moveMenu.type).toBe("action");
    if (moveMenu.type !== "action") return;
    expect(
      moveMenu.submenu
        ?.filter((item) => item.type === "action")
        .map((item) => item.label),
    ).toEqual(["Battlefield...", "Hand", "Exile...", "Library..."]);
    const libraryMenu = moveMenu.submenu?.find(
      (item) => item.type === "action" && item.label === "Library...",
    );
    expect(libraryMenu?.type).toBe("action");
    if (!libraryMenu || libraryMenu.type !== "action") return;
    expect(
      libraryMenu.submenu?.map((item) =>
        item.type === "action" ? item.label : "",
      ),
    ).toEqual(["Bottom in random order"]);
  });

  it("does not build a group menu from one card or a mixed-zone selection", () => {
    const hand = makeZone("hand", ZONE.HAND, "p1");
    const graveyard = makeZone("gy", ZONE.GRAVEYARD, "p1");
    const moveCards = vi.fn();
    const setCardsReveal = vi.fn();
    const params = {
      cards: [{ ...baseCard, zoneId: hand.id }],
      currentZone: hand,
      zones: { [hand.id]: hand, [graveyard.id]: graveyard },
      myPlayerId: "p1",
      viewerRole: "player" as const,
      moveCards,
      setCardsReveal,
    };
    expect(buildGroupActions(params)).toEqual([]);
    expect(
      buildGroupActions({
        ...params,
        cards: [
          { ...baseCard, id: "c1", zoneId: hand.id },
          { ...baseCard, id: "c2", zoneId: graveyard.id },
        ],
      }),
    ).toEqual([]);
  });
});

describe("buildCardActions", () => {
  it("lets an exile-zone owner turn one face-down card face up", () => {
    const exile = makeZone("exile", ZONE.EXILE, "p1");
    const turnExiledCardFaceUp = vi.fn();
    const actions = buildCardActions({
      card: {
        ...baseCard,
        zoneId: exile.id,
        faceDown: true,
        name: "Card",
      },
      zones: { [exile.id]: exile },
      myPlayerId: "p1",
      viewerRole: "player",
      moveCard: vi.fn(),
      tapCard: vi.fn(),
      transformCard: vi.fn(),
      duplicateCard: vi.fn(),
      createRelatedCard: vi.fn(),
      addCounter: vi.fn(),
      removeCounter: vi.fn(),
      openAddCounterModal: vi.fn(),
      globalCounters: {},
      turnExiledCardFaceUp,
    });

    const turnFaceUp = actions.find(
      (action) => action.type === "action" && action.label === "Turn face up",
    );
    expect(turnFaceUp?.type).toBe("action");
    if (!turnFaceUp || turnFaceUp.type !== "action") return;
    turnFaceUp.onSelect();
    expect(turnExiledCardFaceUp).toHaveBeenCalledWith("c1");
  });

  it("limits battlefield actions to Inspect only for non-controllers", () => {
    const otherBattlefield = makeZone("bf-other", ZONE.BATTLEFIELD, "p2");
    const zones = { [otherBattlefield.id]: otherBattlefield };
    const actions = buildCardActions({
      card: {
        ...baseCard,
        ownerId: "p2",
        controllerId: "p2",
        zoneId: otherBattlefield.id,
      },
      zones,
      myPlayerId: "p1",
      viewerRole: "player",
      moveCard: vi.fn(),
      tapCard: vi.fn(),
      transformCard: vi.fn(),
      duplicateCard: vi.fn(),
      createRelatedCard: vi.fn(),
      addCounter: vi.fn(),
      removeCounter: vi.fn(),
      openAddCounterModal: vi.fn(),
      globalCounters: {},
      lockPreview: vi.fn(),
      previewAnchorEl: document.createElement("div"),
    });

    const labels = actions.map((a) => (a.type === "action" ? a.label : ""));
    expect(labels).toEqual(["Inspect"]);
  });

  it("limits battlefield actions to Inspect and Move for owners without control", () => {
    const otherBattlefield = makeZone("bf-other", ZONE.BATTLEFIELD, "p2");
    const hand = makeZone("hand-owner", ZONE.HAND, "p1");
    const graveyard = makeZone("gy-owner", ZONE.GRAVEYARD, "p1");
    const exile = makeZone("exile-owner", ZONE.EXILE, "p1");
    const library = makeZone("lib-owner", ZONE.LIBRARY, "p1");
    const zones = {
      [otherBattlefield.id]: otherBattlefield,
      [hand.id]: hand,
      [graveyard.id]: graveyard,
      [exile.id]: exile,
      [library.id]: library,
    };
    const actions = buildCardActions({
      card: {
        ...baseCard,
        ownerId: "p1",
        controllerId: "p2",
        zoneId: otherBattlefield.id,
      },
      zones,
      myPlayerId: "p1",
      viewerRole: "player",
      moveCard: vi.fn(),
      moveCardToBottom: vi.fn(),
      tapCard: vi.fn(),
      transformCard: vi.fn(),
      duplicateCard: vi.fn(),
      createRelatedCard: vi.fn(),
      addCounter: vi.fn(),
      removeCounter: vi.fn(),
      openAddCounterModal: vi.fn(),
      globalCounters: {},
      lockPreview: vi.fn(),
      previewAnchorEl: document.createElement("div"),
    });

    const labels = actions.map((a) => (a.type === "action" ? a.label : ""));
    expect(labels).toEqual(["Inspect", "Move to..."]);
  });

  it("adds Inspect for commander zone cards", () => {
    const commander = makeZone("cmd", ZONE.COMMANDER, "p1");
    const zones = { [commander.id]: commander };
    const actions = buildCardActions({
      card: { ...baseCard, zoneId: commander.id, ownerId: "p1", controllerId: "p1" },
      zones,
      myPlayerId: "p1",
      viewerRole: "player",
      moveCard: vi.fn(),
      tapCard: vi.fn(),
      transformCard: vi.fn(),
      duplicateCard: vi.fn(),
      createRelatedCard: vi.fn(),
      addCounter: vi.fn(),
      removeCounter: vi.fn(),
      openAddCounterModal: vi.fn(),
      globalCounters: {},
      lockPreview: vi.fn(),
      previewAnchorEl: document.createElement("div"),
    });

    const labels = actions.map((a) => (a.type === "action" ? a.label : ""));
    expect(labels).toContain("Inspect");
  });

  it("adds Inspect for hand cards when identity is visible", () => {
    const hand = makeZone("hand", ZONE.HAND, "p1");
    const zones = { [hand.id]: hand };
    const actions = buildCardActions({
      card: { ...baseCard, zoneId: hand.id, ownerId: "p1", controllerId: "p1" },
      zones,
      myPlayerId: "p1",
      viewerRole: "player",
      moveCard: vi.fn(),
      tapCard: vi.fn(),
      transformCard: vi.fn(),
      duplicateCard: vi.fn(),
      createRelatedCard: vi.fn(),
      addCounter: vi.fn(),
      removeCounter: vi.fn(),
      openAddCounterModal: vi.fn(),
      globalCounters: {},
      lockPreview: vi.fn(),
      previewAnchorEl: document.createElement("div"),
    });

    const labels = actions.map((a) => (a.type === "action" ? a.label : ""));
    expect(labels).toContain("Inspect");
  });

  it("keeps single-card hand moves in the shared move menu", () => {
    const hand = makeZone("hand", ZONE.HAND, "p1");
    hand.cardIds = ["c1", "c2"];
    const graveyard = makeZone("gy", ZONE.GRAVEYARD, "p1");
    const zones = { [hand.id]: hand, [graveyard.id]: graveyard };
    const openRandomDiscardPrompt = vi.fn();

    const actions = buildCardActions({
      card: { ...baseCard, zoneId: hand.id, ownerId: "p1", controllerId: "p1" },
      zones,
      myPlayerId: "p1",
      viewerRole: "player",
      moveCard: vi.fn(),
      tapCard: vi.fn(),
      transformCard: vi.fn(),
      duplicateCard: vi.fn(),
      createRelatedCard: vi.fn(),
      addCounter: vi.fn(),
      removeCounter: vi.fn(),
      openAddCounterModal: vi.fn(),
      globalCounters: {},
      openRandomDiscardPrompt,
    });

    const labels = actions
      .filter((a): a is Extract<typeof a, { type: "action" }> => a.type === "action")
      .map((a) => a.label);
    expect(labels).not.toContain("Play");
    expect(labels).not.toContain("Discard");
    expect(labels).toContain("Discard random card");

    const moveMenu = actions.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Move to..."
    );
    const moveLabels =
      moveMenu?.submenu?.map((a) => (a.type === "action" ? a.label : "")) ?? [];
    expect(moveLabels).toContain(ZONE_LABEL.graveyard);

    const randomDiscard = actions.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Discard random card"
    );
    randomDiscard?.onSelect();
    expect(openRandomDiscardPrompt).toHaveBeenCalledWith(2);
  });

  it("does not add Inspect for hand cards when identity is hidden", () => {
    const hand = makeZone("hand", ZONE.HAND, "p1");
    const zones = { [hand.id]: hand };
    const actions = buildCardActions({
      card: { ...baseCard, zoneId: hand.id, ownerId: "p1", controllerId: "p1" },
      zones,
      myPlayerId: "p2",
      viewerRole: "player",
      moveCard: vi.fn(),
      tapCard: vi.fn(),
      transformCard: vi.fn(),
      duplicateCard: vi.fn(),
      createRelatedCard: vi.fn(),
      addCounter: vi.fn(),
      removeCounter: vi.fn(),
      openAddCounterModal: vi.fn(),
      globalCounters: {},
      lockPreview: vi.fn(),
      previewAnchorEl: document.createElement("div"),
    });

    const labels = actions.map((a) => (a.type === "action" ? a.label : ""));
    expect(labels).not.toContain("Inspect");
  });

  it("allows controller actions on another player's battlefield", () => {
    const otherBattlefield = makeZone("bf-other", ZONE.BATTLEFIELD, "p2");
    const zones = { [otherBattlefield.id]: otherBattlefield };
    const actions = buildCardActions({
      card: {
        ...baseCard,
        ownerId: "p1",
        controllerId: "p1",
        zoneId: otherBattlefield.id,
      },
      zones,
      myPlayerId: "p1",
      viewerRole: "player",
      moveCard: vi.fn(),
      tapCard: vi.fn(),
      transformCard: vi.fn(),
      duplicateCard: vi.fn(),
      createRelatedCard: vi.fn(),
      addCounter: vi.fn(),
      removeCounter: vi.fn(),
      openAddCounterModal: vi.fn(),
      globalCounters: {},
    });

    expect(
      actions.some((a) => a.type === "action" && a.label === "Tap/Untap")
    ).toBe(true);
  });

  it("includes tap/untap on battlefield", () => {
    const battlefield = makeZone("bf", ZONE.BATTLEFIELD, "p1");
    const zones = { [battlefield.id]: battlefield };
    const actions = buildCardActions({
      card: { ...baseCard, zoneId: battlefield.id },
      zones,
      myPlayerId: "p1",
      viewerRole: "player",
      moveCard: vi.fn(),
      tapCard: vi.fn(),
      transformCard: vi.fn(),
      duplicateCard: vi.fn(),
      createRelatedCard: vi.fn(),
      addCounter: vi.fn(),
      removeCounter: vi.fn(),
      openAddCounterModal: vi.fn(),
      globalCounters: {},
    });
    expect(
      actions.some((a) => a.type === "action" && a.label === "Tap/Untap")
    ).toBe(true);
  });

  it("creates related submenu items when multiple parts exist", () => {
    const battlefield = makeZone("bf", ZONE.BATTLEFIELD, "p1");
    const zones = { [battlefield.id]: battlefield };
    const actions = buildCardActions({
      card: {
        ...baseCard,
        zoneId: battlefield.id,
        scryfall: {
          all_parts: [
            {
              id: "p1",
              name: "A",
              uri: "u1",
              component: "token",
              object: "related_card",
            },
            {
              id: "p2",
              name: "B",
              uri: "u2",
              component: "token",
              object: "related_card",
            },
          ],
        } as any,
      },
      zones,
      myPlayerId: "p1",
      viewerRole: "player",
      moveCard: vi.fn(),
      tapCard: vi.fn(),
      transformCard: vi.fn(),
      duplicateCard: vi.fn(),
      createRelatedCard: vi.fn(),
      addCounter: vi.fn(),
      removeCounter: vi.fn(),
      openAddCounterModal: vi.fn(),
      globalCounters: {},
    });

    const relatedParent = actions.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Create related"
    );
    expect(relatedParent).toBeDefined();
    expect(relatedParent?.submenu?.length).toBe(2);
  });

  it("builds a consolidated counter submenu with recent and active counters", () => {
    const battlefield = makeZone("bf", ZONE.BATTLEFIELD, "p1");
    const zones = { [battlefield.id]: battlefield };
    const actions = buildCardActions({
      card: {
        ...baseCard,
        zoneId: battlefield.id,
        counters: [{ type: "+1/+1", count: 2 }],
      },
      zones,
      myPlayerId: "p1",
      viewerRole: "player",
      moveCard: vi.fn(),
      tapCard: vi.fn(),
      transformCard: vi.fn(),
      duplicateCard: vi.fn(),
      createRelatedCard: vi.fn(),
      addCounter: vi.fn(),
      removeCounter: vi.fn(),
      openAddCounterModal: vi.fn(),
      globalCounters: { charge: "#000", "+1/+1": "#0f0" },
    });

    expect(
      actions.some((a) => a.type === "action" && a.label === "Add counter")
    ).toBe(false);
    expect(
      actions.some((a) => a.type === "action" && a.label === "Remove counter")
    ).toBe(false);

    const addParent = actions.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Add/remove counters"
    );
    expect(addParent?.submenu?.[0]).toMatchObject({
      type: "action",
      label: "Add a new counter...",
    });
    expect(addParent?.submenu).toContainEqual({
      type: "label",
      label: "Recently used counters:",
    });
    expect(
      addParent?.submenu?.some(
        (item: any) =>
          item.type === "action" &&
          item.label === "charge" &&
          item.closeOnSelect === false
      )
    ).toBe(true);
    expect(
      addParent?.submenu?.some(
        (item: any) => item.type === "action" && item.label === "+1/+1"
      )
    ).toBe(false);
    expect(
      addParent?.submenu?.some(
        (item: any) =>
          item.type === "counter-control" &&
          item.label === "+1/+1" &&
          item.count === 2
      )
    ).toBe(true);
  });

  it("suppresses duplicate recent counters when legacy card data uses mixed case", () => {
    const battlefield = makeZone("bf", ZONE.BATTLEFIELD, "p1");
    const zones = { [battlefield.id]: battlefield };
    const actions = buildCardActions({
      card: {
        ...baseCard,
        zoneId: battlefield.id,
        counters: [{ type: "Poison", count: 1 }],
      },
      zones,
      myPlayerId: "p1",
      viewerRole: "player",
      moveCard: vi.fn(),
      tapCard: vi.fn(),
      transformCard: vi.fn(),
      duplicateCard: vi.fn(),
      createRelatedCard: vi.fn(),
      addCounter: vi.fn(),
      removeCounter: vi.fn(),
      openAddCounterModal: vi.fn(),
      globalCounters: { poison: "#0f0" },
    });

    const counterParent = actions.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Add/remove counters"
    );

    expect(
      counterParent?.submenu?.some(
        (item: any) => item.type === "action" && item.label === "poison"
      )
    ).toBe(false);
    expect(
      counterParent?.submenu?.some(
        (item: any) =>
          item.type === "counter-control" &&
          item.label === "Poison" &&
          item.count === 1
      )
    ).toBe(true);
  });

  it("merges legacy mixed-case active counters into one control row", () => {
    const battlefield = makeZone("bf", ZONE.BATTLEFIELD, "p1");
    const zones = { [battlefield.id]: battlefield };
    const addCounter = vi.fn();
    const removeCounter = vi.fn();
    const actions = buildCardActions({
      card: {
        ...baseCard,
        zoneId: battlefield.id,
        counters: [
          { type: "Poison", count: 1 },
          { type: "poison", count: 3 },
        ],
      },
      zones,
      myPlayerId: "p1",
      viewerRole: "player",
      moveCard: vi.fn(),
      tapCard: vi.fn(),
      transformCard: vi.fn(),
      duplicateCard: vi.fn(),
      createRelatedCard: vi.fn(),
      addCounter,
      removeCounter,
      openAddCounterModal: vi.fn(),
      globalCounters: {},
    });

    const counterParent = actions.find(
      (a): a is Extract<typeof a, { type: "action" }> =>
        a.type === "action" && a.label === "Add/remove counters"
    );
    const counterControls = (
      counterParent?.submenu?.filter(
        (item): item is Extract<typeof item, { type: "counter-control" }> =>
          item.type === "counter-control"
      ) ?? []
    );

    expect(counterControls).toHaveLength(1);
    expect(counterControls[0]).toMatchObject({
      label: "Poison",
      count: 4,
    });

    counterControls[0].onIncrement();
    counterControls[0].onDecrement();

    expect(addCounter).toHaveBeenCalledWith("c1", {
      type: "poison",
      count: 1,
      color: expect.any(String),
    });
    expect(removeCounter).toHaveBeenCalledWith("c1", "poison");
  });
});
