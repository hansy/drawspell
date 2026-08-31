import type {
  Card,
  CardId,
  CardReveal,
  Player,
  PlayerId,
  ViewerRole,
  Zone,
  ZoneId,
} from "@/types";

import { ZONE, ZONE_LABEL } from "@/constants/zones";
import { getPlayerZones } from "@/lib/gameSelectors";
import { shuffle } from "@/lib/shuffle";
import { canMoveCard } from "@/rules/permissions";
import type { ContextMenuItem } from "./types";

type GroupMove = {
  cardId: CardId;
  toZoneId: ZoneId;
  placement?: "top" | "bottom";
  opts?: {
    random?: boolean;
    faceDown?: boolean;
    faceDownMode?: "morph";
  };
};

type GroupActionBuilderParams = {
  cards: Card[];
  currentZone: Zone;
  zones: Record<ZoneId, Zone>;
  players?: Record<PlayerId, Player>;
  myPlayerId: PlayerId;
  viewerRole?: ViewerRole;
  moveCards: (moves: GroupMove[]) => void;
  setCardsReveal: (reveal: CardReveal) => void;
};

const buildGroupRevealMenu = ({
  cards,
  currentZone,
  players,
  myPlayerId,
  setCardsReveal,
}: Pick<
  GroupActionBuilderParams,
  "cards" | "currentZone" | "players" | "myPlayerId" | "setCardsReveal"
>): ContextMenuItem | null => {
  const canRevealHiddenGroup =
    (currentZone.type === ZONE.HAND || currentZone.type === ZONE.LIBRARY) &&
    cards.every((card) => card.ownerId === myPlayerId);
  const canRevealFaceDownGroup =
    currentZone.type === ZONE.BATTLEFIELD &&
    cards.every(
      (card) => card.faceDown && card.controllerId === myPlayerId,
    );
  if (!canRevealHiddenGroup && !canRevealFaceDownGroup) return null;
  const others = players
    ? Object.values(players).filter((player) => player.id !== myPlayerId)
    : [];
  const submenu: ContextMenuItem[] = [
    {
      type: "action",
      label: "Everyone",
      onSelect: () => setCardsReveal({ toAll: true }),
    },
  ];
  if (others.length > 0) {
    submenu.push({ type: "separator" });
    submenu.push(
      ...others.map(
        (player): ContextMenuItem => ({
          type: "action",
          label: player.name || player.id,
          onSelect: () => setCardsReveal({ to: [player.id] }),
        }),
      ),
    );
  }
  submenu.push(
    { type: "separator" },
    {
      type: "action",
      label: "Hide from everyone",
      onSelect: () => setCardsReveal(null),
    },
  );
  return {
    type: "action",
    label: "Reveal to...",
    onSelect: () => {},
    submenu,
  };
};

const buildGroupMoveMenu = (
  params: GroupActionBuilderParams,
): ContextMenuItem | null => {
  const { cards, currentZone, zones, myPlayerId, viewerRole, moveCards } = params;
  const playerZones = getPlayerZones(zones, currentZone.ownerId);
  const submenu: ContextMenuItem[] = [];
  const canMoveAllTo = (target: Zone | undefined) => {
    if (!target) return false;
    if (target.id === currentZone.id && target.type !== ZONE.LIBRARY) {
      return false;
    }
    return cards.every(
      (card) =>
        canMoveCard({
          actorId: myPlayerId,
          role: viewerRole,
          card,
          fromZone: currentZone,
          toZone: target,
        }).allowed,
    );
  };
  const movesTo = (
    target: Zone,
    options?: Omit<GroupMove, "cardId" | "toZoneId">,
  ): GroupMove[] =>
    cards.map((card) => ({ cardId: card.id, toZoneId: target.id, ...options }));

  if (playerZones.battlefield && canMoveAllTo(playerZones.battlefield)) {
    submenu.push({
      type: "action",
      label: `${ZONE_LABEL.battlefield}...`,
      onSelect: () => {},
      submenu: [
        {
          type: "action",
          label: "Face up",
          onSelect: () => moveCards(movesTo(playerZones.battlefield!)),
        },
        {
          type: "action",
          label: "Face down...",
          onSelect: () => {},
          submenu: [
            {
              type: "action",
              label: "with morph (2/2)",
              onSelect: () =>
                moveCards(
                  movesTo(playerZones.battlefield!, {
                    opts: { faceDown: true, faceDownMode: "morph" },
                  }),
                ),
            },
            {
              type: "action",
              label: "without morph",
              onSelect: () =>
                moveCards(
                  movesTo(playerZones.battlefield!, {
                    opts: { faceDown: true },
                  }),
                ),
            },
          ],
        },
      ],
    });
  }

  const addDestination = (target: Zone | undefined, label: string) => {
    if (!target || !canMoveAllTo(target)) return;
    submenu.push({
      type: "action",
      label,
      onSelect: () => moveCards(movesTo(target)),
    });
  };
  addDestination(playerZones.hand, ZONE_LABEL.hand);
  addDestination(playerZones.graveyard, ZONE_LABEL.graveyard);
  addDestination(playerZones.exile, ZONE_LABEL.exile);

  if (playerZones.library && canMoveAllTo(playerZones.library)) {
    submenu.push({
      type: "action",
      label: `${ZONE_LABEL.library}...`,
      onSelect: () => {},
      submenu: [
        {
          type: "action",
          label: "Bottom in random order",
          onSelect: () =>
            moveCards(
              shuffle(cards).map((card) => ({
                cardId: card.id,
                toZoneId: playerZones.library!.id,
                placement: "bottom",
                opts: { random: true },
              })),
            ),
        },
      ],
    });
  }

  return submenu.length
    ? { type: "action", label: "Move to...", onSelect: () => {}, submenu }
    : null;
};

export const buildGroupActions = (
  params: GroupActionBuilderParams,
): ContextMenuItem[] => {
  if (params.cards.length < 2) return [];
  if (!params.cards.every((card) => card.zoneId === params.currentZone.id)) {
    return [];
  }

  return [
    buildGroupRevealMenu(params),
    buildGroupMoveMenu(params),
  ].filter((item): item is ContextMenuItem => item !== null);
};
