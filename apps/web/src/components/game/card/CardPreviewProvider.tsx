import React from "react";
import { Card as CardType } from "@/types";
import { useDragStore } from "@/store/dragStore";
import { useGameStore } from "@/store/gameStore";
import { setCardPreviewLockHandler } from "@/lib/cardPreviewLock";
import {
  debugLog,
  summarizeCardPreviewElement,
  summarizeElement,
} from "@/lib/debug";
import { CardPreview } from "./CardPreview";

type PreviewState = {
  card: CardType;
  anchorEl: HTMLElement;
  locked: boolean;
} | null;

interface CardPreviewContextValue {
  showPreview: (card: CardType, anchorEl: HTMLElement) => void;
  hidePreview: (cardId?: string) => void;
  lockPreview: (card: CardType, anchorEl: HTMLElement) => void;
  toggleLock: (card: CardType, anchorEl: HTMLElement) => void;
  unlockPreview: () => void;
  isLocked: boolean;
  previewCardId: string | null;
}

const CardPreviewContext = React.createContext<CardPreviewContextValue | null>(
  null
);

export const CardPreviewProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [preview, setPreview] = React.useState<PreviewState>(null);
  const activeCardId = useDragStore((state) => state.activeCardId);

  const showPreview = React.useCallback((card: CardType, anchorEl: HTMLElement) => {
    debugLog("battlefieldDnd", "card-preview-show-request", {
      cardId: card.id,
      anchorElement: summarizeElement(anchorEl),
    });
    setPreview((prev) => {
      if (prev?.locked) return prev;
      return { card, anchorEl, locked: false };
    });
  }, []);

  const hidePreview = React.useCallback((cardId?: string) => {
    setPreview((prev) => {
      if (prev?.locked) return prev;
      if (cardId && prev?.card.id !== cardId) return prev;
      if (prev) {
        debugLog("battlefieldDnd", "card-preview-hide", {
          cardId: prev.card.id,
          requestedCardId: cardId ?? null,
          locked: prev.locked,
          previewElement: summarizeCardPreviewElement(prev.card.id),
        });
      }
      return null;
    });
  }, []);

  const lockPreview = React.useCallback((card: CardType, anchorEl: HTMLElement) => {
    debugLog("battlefieldDnd", "card-preview-lock", {
      cardId: card.id,
      anchorElement: summarizeElement(anchorEl),
    });
    setPreview({ card, anchorEl, locked: true });
  }, []);

  const toggleLock = React.useCallback((card: CardType, anchorEl: HTMLElement) => {
    setPreview((prev) => {
      // If already locked on this card, unlock it
      if (prev?.locked && prev.card.id === card.id) {
        debugLog("battlefieldDnd", "card-preview-unlock-toggle", {
          cardId: card.id,
          previewElement: summarizeCardPreviewElement(card.id),
        });
        return null;
      }
      // Otherwise lock on this card
      debugLog("battlefieldDnd", "card-preview-lock-toggle", {
        cardId: card.id,
        anchorElement: summarizeElement(anchorEl),
        previousCardId: prev?.card.id ?? null,
        previousLocked: prev?.locked ?? null,
      });
      return { card, anchorEl, locked: true };
    });
  }, []);

  const unlockPreview = React.useCallback(() => {
    setPreview((prev) => {
      if (prev) {
        debugLog("battlefieldDnd", "card-preview-unlock", {
          cardId: prev.card.id,
          locked: prev.locked,
          previewElement: summarizeCardPreviewElement(prev.card.id),
        });
      }
      return null;
    });
  }, []);

  React.useEffect(() => {
    if (activeCardId) {
      setPreview((prev) => {
        if (prev) {
          debugLog("battlefieldDnd", "card-preview-cleared-for-drag", {
            activeCardId,
            previewCardId: prev.card.id,
            locked: prev.locked,
            previewElement: summarizeCardPreviewElement(prev.card.id),
            anchorElement: summarizeElement(prev.anchorEl),
          });
        }
        return null;
      });
    }
  }, [activeCardId]);

  React.useEffect(() => {
    setCardPreviewLockHandler(({ cardId, anchorEl }) => {
      const card = useGameStore.getState().cards[cardId];
      if (!card) return;
      const resolvedAnchor =
        anchorEl && anchorEl.isConnected
          ? anchorEl
          : (document.querySelector(`[data-card-id="${cardId}"]`) as HTMLElement | null);
      if (!resolvedAnchor) return;
      toggleLock(card, resolvedAnchor);
    });
    return () => {
      setCardPreviewLockHandler(null);
    };
  }, [toggleLock]);

  const value = React.useMemo(
    () => ({
      showPreview,
      hidePreview,
      lockPreview,
      toggleLock,
      unlockPreview,
      isLocked: !!preview?.locked,
      previewCardId: preview?.card.id ?? null,
    }),
    [
      showPreview,
      hidePreview,
      lockPreview,
      toggleLock,
      unlockPreview,
      preview?.card.id,
      preview?.locked,
    ]
  );

  return (
    <CardPreviewContext.Provider value={value}>
      {children}
      {preview && (
        <CardPreview
          card={preview.card}
          anchorEl={preview.anchorEl}
          locked={preview.locked}
          onClose={unlockPreview}
        />
      )}
    </CardPreviewContext.Provider>
  );
};

export const useCardPreview = () => {
  const ctx = React.useContext(CardPreviewContext);
  if (!ctx) {
    throw new Error("useCardPreview must be used within CardPreviewProvider");
  }
  return ctx;
};

/** Preview integration for reusable surfaces that can also render in isolation (for example, tests). */
export const useOptionalCardPreview = () => React.useContext(CardPreviewContext);
