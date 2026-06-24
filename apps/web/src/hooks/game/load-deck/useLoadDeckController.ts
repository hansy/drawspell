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
import { getYDocHandles, getYProvider } from "@/yjs/docManager";
import { useClientPrefsStore } from "@/store/clientPrefsStore";
import {
  isMultiplayerProviderReady,
  planDeckImport,
  shouldConfirmCuratedDeckReplacement,
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

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const wasOpenRef = React.useRef(false);

  const addCards = useGameStore((state) => state.addCards);
  const addZone = useGameStore((state) => state.addZone);
  const setDeckLoaded = useGameStore((state) => state.setDeckLoaded);
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
  }, [isOpen, lastImportedDeckText]);

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
        planned.chunks.forEach((chunk) => {
          chunk.forEach(({ zoneId, zoneType }) => {
            if (!zones[zoneId] && !missingZones.has(zoneId)) {
              missingZones.set(zoneId, zoneType);
            }
          });
        });

        if (missingZones.size) {
          missingZones.forEach((zoneType, zoneId) => {
            addZone({ id: zoneId, ownerId: playerId, type: zoneType, cardIds: [] });
          });
        }

        planned.chunks.forEach((chunk) => {
          const batch = chunk.map(({ cardData, zoneId }) =>
            createCardFromImport(cardData, playerId, zoneId)
          );
          addCards(batch);
        });

        setDeckLoaded(playerId, true);
        shuffleLibrary(playerId, playerId);

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
      setLastImportedDeckText,
      shuffleLibrary,
      viewerRole,
      cards,
      zones,
    ]
  );

  const handleImport = React.useCallback(async () => {
    const selectedCuratedDeck = selectedCuratedDeckId
      ? curatedDecks.find((deck) => deck.id === selectedCuratedDeckId)
      : null;
    const isUnchangedCuratedDeck =
      Boolean(selectedCuratedDeck) &&
      importText.trim() === selectedCuratedDeck?.decklist.trim();

    await importDeckText(importText, { saveAsLastImport: !isUnchangedCuratedDeck });
  }, [importDeckText, importText, selectedCuratedDeckId]);

  const handleCuratedDeckImport = React.useCallback(
    (deck: CuratedDeck) => {
      if (isImporting) return;

      if (
        shouldConfirmCuratedDeckReplacement(importText) &&
        !window.confirm(`Replace the current deck list with ${deck.name}?`)
      ) {
        return;
      }

      setPrefilledFromLastImport(false);
      setError(null);
      setImportText(deck.decklist);
      setSelectedCuratedDeckId(deck.id);
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(0, 0);
      }, 0);
    },
    [importText, isImporting]
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
