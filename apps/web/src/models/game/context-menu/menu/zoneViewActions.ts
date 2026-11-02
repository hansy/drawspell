import { m } from "@/paraglide/messages.js";
import type {
  LibraryTopRevealMode,
  PlayerId,
  Player,
  ViewerRole,
  Zone,
  ZoneId,
} from "@/types";

import { ZONE } from "@/constants/zones";
import { canViewZone } from "@/rules/permissions";
import { getShortcutLabel } from "@/models/game/shortcuts/gameShortcuts";
import {
  buildLibraryTopRevealFromSelectedIds,
  libraryTopRevealSelectedIds,
} from "@mtg/shared/types/players";

import type { ContextMenuItem } from "./types";

interface ZoneActionBuilderParams {
  zone: Zone;
  myPlayerId: PlayerId;
  viewerRole?: ViewerRole;
  onViewZone?: (zoneId: ZoneId, count?: number) => void;
  drawCard: (playerId: PlayerId) => void;
  discardFromLibrary: (playerId: PlayerId, count?: number) => void;
  exileFromLibrary: (
    playerId: PlayerId,
    count?: number,
    options?: { faceDown?: boolean },
  ) => void;
  moveBottomLibraryCardToHand: (playerId: PlayerId) => void;
  shuffleLibrary: (playerId: PlayerId) => void;
  resetDeck: (playerId: PlayerId) => void;
  mulligan: (playerId: PlayerId, count: number) => void;
  unloadDeck: (playerId: PlayerId) => void;
  libraryTopReveal?: LibraryTopRevealMode | null;
  setLibraryTopReveal?: (mode: LibraryTopRevealMode | null) => void;
  players?: Record<PlayerId, Player>;
  openCountPrompt?: (opts: {
    title: string;
    message?: string;
    onSubmit: (count: number) => void;
    initialValue?: number;
    minValue?: number;
    maxValue?: number;
    inputLabel?: string;
    showMaxButton?: boolean;
    confirmLabel?: string;
  }) => void;
}

type CountPromptHandler = NonNullable<ZoneActionBuilderParams["openCountPrompt"]>;


const buildCountPromptAction = ({
  label,
  shortcut,
  openCountPrompt,
  buildPromptOptions,
}: {
  label: string;
  shortcut?: string;
  openCountPrompt?: ZoneActionBuilderParams["openCountPrompt"];
  buildPromptOptions: () => Parameters<CountPromptHandler>[0];
}): ContextMenuItem => ({
  type: "action",
  label,
  onSelect: () => {
    if (!openCountPrompt) return;
    openCountPrompt(buildPromptOptions());
  },
  disabledReason: openCountPrompt ? undefined : m.prompt_unavailable(),
  shortcut,
});

const buildLibraryDrawMenu = ({
  myPlayerId,
  drawCard,
  openCountPrompt,
}: {
  myPlayerId: PlayerId;
  drawCard: (playerId: PlayerId) => void;
  openCountPrompt?: ZoneActionBuilderParams["openCountPrompt"];
}): ContextMenuItem => {
  const submenu: ContextMenuItem[] = [
    {
      type: "action",
      label: m.zone_view_actions_draw_1(),
      onSelect: () => drawCard(myPlayerId),
      shortcut: getShortcutLabel("game.drawOne"),
    },
    buildCountPromptAction({
      label: m.zone_view_actions_draw_x(),
      openCountPrompt,
      buildPromptOptions: () => ({
        title: m.model_draw_cards(),
        message: m.model_how_many_cards_to_draw(),
        inputLabel: m.model_cards_to_draw(),
        confirmLabel: m.model_draw(),
        onSubmit: (count) => {
          for (let i = 0; i < count; i++) {
            drawCard(myPlayerId);
          }
        },
      }),
      shortcut: getShortcutLabel("game.drawX"),
    }),
  ];

  return {
    type: "action",
    label: m.zone_view_actions_draw(),
    onSelect: () => {},
    submenu,
  };
};

const buildLibraryDiscardMenu = ({
  myPlayerId,
  discardFromLibrary,
  openCountPrompt,
}: {
  myPlayerId: PlayerId;
  discardFromLibrary: (playerId: PlayerId, count?: number) => void;
  openCountPrompt?: ZoneActionBuilderParams["openCountPrompt"];
}): ContextMenuItem => {
  const submenu: ContextMenuItem[] = [
    {
      type: "action",
      label: m.zone_view_actions_mill_1(),
      onSelect: () => discardFromLibrary(myPlayerId, 1),
      shortcut: getShortcutLabel("game.discardOne"),
    },
    buildCountPromptAction({
      label: m.zone_view_actions_mill_x(),
      openCountPrompt,
      buildPromptOptions: () => ({
        title: m.model_mill_cards(),
        message: m.zone_view_actions_how_many_cards_to_mill(),
        inputLabel: m.model_cards_to_mill(),
        confirmLabel: m.model_mill(),
        onSubmit: (count) => discardFromLibrary(myPlayerId, count),
        minValue: 1,
      }),
      shortcut: getShortcutLabel("game.discardX"),
    }),
  ];

  return {
    type: "action",
    label: m.zone_view_actions_mill(),
    onSelect: () => {},
    submenu,
  };
};

const buildLibraryExileMenu = ({
  myPlayerId,
  exileFromLibrary,
  libraryCount,
  openCountPrompt,
}: {
  myPlayerId: PlayerId;
  exileFromLibrary: (
    playerId: PlayerId,
    count?: number,
    options?: { faceDown?: boolean },
  ) => void;
  libraryCount?: number;
  openCountPrompt?: ZoneActionBuilderParams["openCountPrompt"];
}): ContextMenuItem => {
  const buildQuantityMenu = (faceDown: boolean): ContextMenuItem[] => [
    {
      type: "action",
      label: m.zone_view_actions_exile_1(),
      onSelect: () => exileFromLibrary(myPlayerId, 1, { faceDown }),
      shortcut: faceDown ? undefined : getShortcutLabel("game.exileOne"),
    },
    buildCountPromptAction({
      label: m.zone_view_actions_exile_top_x(),
      shortcut: faceDown ? undefined : getShortcutLabel("game.exileX"),
      openCountPrompt,
      buildPromptOptions: () => ({
        title: m.model_exile_cards(),
        message: m.zone_view_actions_how_many_cards_from_the_top_of_your_library(),
        inputLabel: m.model_cards_to_exile(),
        onSubmit: (count) => exileFromLibrary(myPlayerId, count, { faceDown }),
        minValue: 1,
        ...(typeof libraryCount === "number" && libraryCount > 0
          ? { maxValue: libraryCount, showMaxButton: true }
          : null),
        confirmLabel: m.model_exile(),
      }),
    }),
  ];

  return {
    type: "action",
    label: m.zone_view_actions_exile(),
    onSelect: () => {},
    submenu: [
      {
        type: "action",
        label: m.zone_view_actions_face_up(),
        onSelect: () => {},
        submenu: buildQuantityMenu(false),
      },
      {
        type: "action",
        label: m.move_to_menu_face_down(),
        onSelect: () => {},
        submenu: buildQuantityMenu(true),
      },
    ],
  };
};

const buildLibraryViewMenu = ({
  zoneId,
  onViewZone,
  openCountPrompt,
}: {
  zoneId: ZoneId;
  onViewZone: (zoneId: ZoneId, count?: number) => void;
  openCountPrompt?: ZoneActionBuilderParams["openCountPrompt"];
}): ContextMenuItem => {
  const submenu: ContextMenuItem[] = [
    {
      type: "action",
      label: m.zone_view_actions_view_all(),
      onSelect: () => onViewZone(zoneId),
      shortcut: getShortcutLabel("zone.viewLibraryAll"),
    },
    buildCountPromptAction({
      label: m.zone_view_actions_view_top_x(),
      openCountPrompt,
      buildPromptOptions: () => ({
        title: m.model_view_top(),
        message: m.model_how_many_cards_from_top(),
        onSubmit: (count) => onViewZone(zoneId, count),
      }),
      shortcut: getShortcutLabel("zone.viewLibraryTop"),
    }),
  ];

  return {
    type: "action",
    label: m.zone_view_actions_view(),
    onSelect: () => {},
    submenu,
  };
};

export const buildZoneViewActions = ({
  zone,
  myPlayerId,
  viewerRole,
  onViewZone,
  drawCard,
  discardFromLibrary,
  exileFromLibrary,
  moveBottomLibraryCardToHand,
  shuffleLibrary,
  resetDeck,
  mulligan,
  unloadDeck,
  libraryTopReveal,
  setLibraryTopReveal,
  players,
  openCountPrompt,
}: ZoneActionBuilderParams): ContextMenuItem[] => {
  const items: ContextMenuItem[] = [];

  if (zone.type === ZONE.LIBRARY) {
    const viewAllPermission = canViewZone(
      { actorId: myPlayerId, role: viewerRole },
      zone,
      { viewAll: true }
    );
    if (!viewAllPermission.allowed) return items;
    if (zone.ownerId !== myPlayerId) return items;

    items.push(buildLibraryDrawMenu({ myPlayerId, drawCard, openCountPrompt }));
    items.push(
      buildLibraryDiscardMenu({
        myPlayerId,
        discardFromLibrary,
        openCountPrompt,
      })
    );
    items.push(
      buildLibraryExileMenu({
        myPlayerId,
        exileFromLibrary,
        libraryCount: players?.[myPlayerId]?.libraryCount,
        openCountPrompt,
      }),
    );
    items.push({
      type: "action",
      label: m.zone_view_actions_put_bottom_card_into_hand(),
      onSelect: () => moveBottomLibraryCardToHand(myPlayerId),
    });

    if (onViewZone) {
      items.push(
        buildLibraryViewMenu({ zoneId: zone.id, onViewZone, openCountPrompt })
      );
    }

    if (setLibraryTopReveal) {
      const orderedPlayers = Object.values(players ?? {})
        .sort((left, right) => left.name.localeCompare(right.name));
      const fallbackPlayers =
        orderedPlayers.length > 0
          ? orderedPlayers
          : [{ id: myPlayerId, name: "Me" } as Player];
      const allPlayerIds = fallbackPlayers.map((player) => player.id);
      const selectedIds = libraryTopRevealSelectedIds(
        libraryTopReveal,
        zone.ownerId,
        allPlayerIds,
      );
      const selectedIdSet = new Set<PlayerId>(selectedIds);
      const otherPlayers = fallbackPlayers.filter(
        (player) => player.id !== myPlayerId,
      );
      const updateSelection = (nextSelectedIds: PlayerId[]) =>
        setLibraryTopReveal(
          buildLibraryTopRevealFromSelectedIds(nextSelectedIds, allPlayerIds),
        );
      const submenu: ContextMenuItem[] = [
        {
          type: "action",
          label: m.zone_view_actions_to_me(),
          checked: selectedIdSet.has(myPlayerId),
          onSelect: () => {
            const nextSelectedIds = selectedIdSet.has(myPlayerId)
              ? selectedIds.filter((id) => id !== myPlayerId)
              : [...selectedIds, myPlayerId];
            updateSelection(nextSelectedIds);
          },
        },
      ];
      otherPlayers.forEach((player) => {
        submenu.push({
          type: "action",
          label: m.zone_view_actions_to({ value_1: player.name || player.id }),
          checked: selectedIdSet.has(player.id),
          onSelect: () => {
            const nextSelectedIds = selectedIdSet.has(player.id)
              ? selectedIds.filter((id) => id !== player.id)
              : [...selectedIds, player.id];
            updateSelection(nextSelectedIds);
          },
        });
      });
      if (otherPlayers.length > 0) {
        submenu.push({ type: "separator" });
        submenu.push({
          type: "action",
          label: m.zone_view_actions_to_all_players(),
          checked: allPlayerIds.every((id) => selectedIdSet.has(id)),
          onSelect: () => {
            const isChecked = allPlayerIds.every((id) => selectedIdSet.has(id));
            updateSelection(isChecked ? [] : allPlayerIds);
          },
        });
      }
      items.push({
        type: "action",
        label: m.zone_view_actions_top_card_reveal(),
        onSelect: () => {},
        submenu,
      });
    }

    items.push({
      type: "action",
      label: m.zone_view_actions_shuffle(),
      onSelect: () => shuffleLibrary(myPlayerId),
      shortcut: getShortcutLabel("game.shuffleLibrary"),
    });
    items.push(
      buildCountPromptAction({
        label: m.model_mulligan(),
        openCountPrompt,
        buildPromptOptions: () => ({
          title: m.model_mulligan(),
          message: m.model_reset_deck_and_draw_new_cards_how_many_cards_to_draw(),
          initialValue: 7,
          onSubmit: (count) => {
            mulligan(myPlayerId, count);
          },
        }),
        shortcut: getShortcutLabel("game.mulligan"),
      })
    );
    items.push({ type: "separator" });
    items.push({
      type: "action",
      label: m.zone_view_actions_reset(),
      onSelect: () => resetDeck(myPlayerId),
      shortcut: getShortcutLabel("deck.reset"),
    });
    items.push({
      type: "action",
      label: m.zone_view_actions_unload(),
      onSelect: () => unloadDeck(myPlayerId),
      danger: true,
      shortcut: getShortcutLabel("deck.unload"),
    });
  } else if (zone.type === ZONE.GRAVEYARD || zone.type === ZONE.EXILE) {
    const viewPermission = canViewZone(
      { actorId: myPlayerId, role: viewerRole },
      zone
    );
    if (viewPermission.allowed && onViewZone)
      items.push({
        type: "action",
        label: m.zone_view_actions_view_all_2(),
        onSelect: () => onViewZone(zone.id),
        shortcut:
          zone.ownerId === myPlayerId
            ? zone.type === ZONE.GRAVEYARD
              ? getShortcutLabel("zone.viewGraveyard")
              : zone.type === ZONE.EXILE
                ? getShortcutLabel("zone.viewExile")
                : undefined
            : undefined,
      });
  }

  return items;
};
