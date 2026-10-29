import * as React from "react";
import { toast } from "sonner";

import {
  createCardFromImport,
  fetchScryfallCards,
  parseDeckList,
  validateDeckListLimits,
  validateImportResult,
} from "@/services/deck-import/deckImport";
import { curatedDecks, type CuratedDeck } from "@/data/curatedDecks";
import { useGameStore } from "@/store/gameStore";
import { usePreloadDeckStore } from "@/store/preloadDeckStore";
import { waitForIntentAcknowledgement } from "@/store/gameStore/dispatchIntent";
import { getIntentConnectionMeta } from "@/partykit/intentTransport";
import { getYDocHandles, getYProvider } from "@/yjs/docManager";
import { useClientPrefsStore } from "@/store/clientPrefsStore";
import { parseArchidektDeckId } from "@/services/deck-import/archidektImport";
import { fetchArchidektDeck } from "@/server/archidektDeck";
import {
  isMultiplayerProviderReady,
  planDeckImport,
} from "@/models/game/load-deck/loadDeckModel";

export type LoadDeckControllerInput = {
  isOpen: boolean;
  onClose: () => void;
  playerId: string;
};

export const useLoadDeckController = ({
  isOpen,
  onClose,
  playerId,
}: LoadDeckControllerInput) => {
  const [importText, setImportText] = React.useState("");
  const [isImporting, setIsImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [prefilledFromLastImport, setPrefilledFromLastImport] = React.useState(false);
  const [selectedCuratedDeckId, setSelectedCuratedDeckId] = React.useState<string | null>(null);

  const preload = usePreloadDeckStore((state) => state.pending);
  const sessionId = useGameStore((state) => state.sessionId);
  const matchingPreload =
    preload?.sessionId === sessionId && preload.playerId === playerId ? preload : null;

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const wasOpenRef = React.useRef(false);

  const addCards = useGameStore((state) => state.addCards);
  const addZone = useGameStore((state) => state.addZone);
  const setDeckLoaded = useGameStore((state) => state.setDeckLoaded);
  const updatePlayer = useGameStore((state) => state.updatePlayer);
  const shuffleLibrary = useGameStore((state) => state.shuffleLibrary);
  const zones = useGameStore((state) => state.zones);
  const cards = useGameStore((state) => state.cards);
  const players = useGameStore((state) => state.players);
  const viewerRole = useGameStore((state) => state.viewerRole);

  const lastImportedDeckText = useClientPrefsStore((state) => state.lastImportedDeckText);
  const setLastImportedDeckText = useClientPrefsStore((state) => state.setLastImportedDeckText);

  React.useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened) return;

    setError(null);

    if (matchingPreload && !matchingPreload.started) {
      setImportText(matchingPreload.decklist);
      setPrefilledFromLastImport(false);
      return;
    }
    const stored = (lastImportedDeckText ?? "").trim();
    if (stored) {
      setImportText(stored);
      setPrefilledFromLastImport(true);
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }, 0);
    } else {
      setPrefilledFromLastImport(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [isOpen, lastImportedDeckText, matchingPreload]);

  const handleImportTextChange = React.useCallback(
    (next: string) => {
      if (prefilledFromLastImport) setPrefilledFromLastImport(false);
      if (selectedCuratedDeckId) setSelectedCuratedDeckId(null);
      setImportText(next);
    },
    [prefilledFromLastImport, selectedCuratedDeckId]
  );

  const importDeckText = React.useCallback(
    async (deckText: string, options?: { saveAsLastImport?: boolean }) => {
      if (viewerRole === "spectator") return;
      if (!deckText.trim()) return;

      const handles = getYDocHandles();
      const provider = getYProvider();
      if (!isMultiplayerProviderReady({ handles, provider })) {
        toast.error("Connecting to multiplayer, please wait a moment then try again.");
        return;
      }

      setIsImporting(true);
      setError(null);

      try {
        const planned = await planDeckImport({
          importText: deckText,
          playerId,
          targetDeckLoaded: Boolean(players[playerId]?.deckLoaded),
          zones,
          cards,
          parseDeckList,
          validateDeckListLimits,
          fetchScryfallCards,
          validateImportResult,
        });

        if (planned.warnings.length) {
          toast.warning("Imported with warnings", {
            description: planned.warnings.join("\n"),
          });
        }

        const missingZones = new Map<
          string,
          (typeof planned.chunks)[number][number]["zoneType"]
        >();
        for (const chunk of planned.chunks) {
          chunk.forEach(({ zoneId, zoneType }) => {
            if (!zones[zoneId] && !missingZones.has(zoneId)) {
              missingZones.set(zoneId, zoneType);
            }
          });
        }

        if (missingZones.size) {
          for (const [zoneId, zoneType] of missingZones) {
            await waitForIntentAcknowledgement(
              addZone({ id: zoneId, ownerId: playerId, type: zoneType, cardIds: [] })
            );
          }
        }

        for (const chunk of planned.chunks) {
          const batch = chunk.map(({ cardData, zoneId }) =>
            createCardFromImport(cardData, playerId, zoneId)
          );
          await waitForIntentAcknowledgement(addCards(batch));
        }

        updatePlayer(playerId, { life: planned.startingLife }, playerId);
        shuffleLibrary(playerId, playerId);
        await waitForIntentAcknowledgement(setDeckLoaded(playerId, true));

        toast.success("Deck successfully loaded");
        if (options?.saveAsLastImport !== false) {
          setLastImportedDeckText(deckText);
        }
        setImportText("");
        onClose();
      } catch (err: any) {
        console.error("[LoadDeckModal] Import failed:", err);
        setError(err?.message || "Failed to import deck. Please check the format.");
      } finally {
        setIsImporting(false);
      }
    },
    [
      addCards,
      onClose,
      playerId,
      players,
      setDeckLoaded,
      updatePlayer,
      setLastImportedDeckText,
      shuffleLibrary,
      viewerRole,
      cards,
      zones,
    ]
  );

  React.useEffect(() => {
    if (!isOpen || !matchingPreload || matchingPreload.started || isImporting || viewerRole === "spectator") return;
    const attempt = () => {
      if (!players[playerId] || !getIntentConnectionMeta().isOpen) return;
      if (!isMultiplayerProviderReady({ handles: getYDocHandles(), provider: getYProvider() })) return;
      if (!usePreloadDeckStore.getState().start(matchingPreload.assignmentId)) return;
      if (players[playerId].deckLoaded) return;
      setImportText(matchingPreload.decklist);
      void importDeckText(matchingPreload.decklist);
    };
    attempt();
    const timer = setInterval(attempt, 250);
    return () => clearInterval(timer);
  }, [isOpen, matchingPreload, isImporting, viewerRole, players, playerId, importDeckText]);

  const handleImport = React.useCallback(async () => {
    // A pasted Archidekt link is swapped for that deck's list before importing.
    if (parseArchidektDeckId(importText)) {
      setIsImporting(true);
      setError(null);
      let decklist: string;
      try {
        ({ decklist } = await fetchArchidektDeck({ data: { url: importText.trim() } }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load that Archidekt deck.");
        setIsImporting(false);
        return;
      }
      setIsImporting(false);
      setImportText(decklist);
      await importDeckText(decklist, { saveAsLastImport: true });
      return;
    }

    await importDeckText(importText, { saveAsLastImport: true });
  }, [importDeckText, importText]);

  // Clicking a curated deck loads it straight away. The text box is left alone,
  // so a list the player was typing isn't lost.
  const handleCuratedDeckImport = React.useCallback(
    async (deck: CuratedDeck) => {
      if (isImporting) return;
      setError(null);
      setSelectedCuratedDeckId(deck.id);
      await importDeckText(deck.decklist, { saveAsLastImport: false });
    },
    [importDeckText, isImporting]
  );

  return {
    isOpen,
    handleClose: onClose,
    textareaRef,
    importText,
    handleImportTextChange,
    prefilledFromLastImport,
    error,
    isImporting,
    handleImport,
    curatedDecks,
    activeCuratedDeckId: selectedCuratedDeckId,
    handleCuratedDeckImport,
  };
};

export type LoadDeckController = ReturnType<typeof useLoadDeckController>;
