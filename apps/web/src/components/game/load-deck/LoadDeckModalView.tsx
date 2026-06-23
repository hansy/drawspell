import React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { GameDialogActionButton } from "@/components/game/dialog/GameDialogActionButton";
import { cn } from "@/lib/utils";

import type { LoadDeckController } from "@/hooks/game/load-deck/useLoadDeckController";

const CuratedDeckPicker = React.lazy(() =>
  import("./CuratedDeckPicker").then((module) => ({
    default: module.CuratedDeckPicker,
  }))
);

export const LoadDeckModalView: React.FC<LoadDeckController> = ({
  isOpen,
  handleClose,
  textareaRef,
  importText,
  handleImportTextChange,
  prefilledFromLastImport,
  error,
  isImporting,
  handleImport,
  curatedDecks,
  activeCuratedDeckId,
  handleCuratedDeckImport,
}) => {
  const prefilledHintId = React.useId();
  const errorMessageId = React.useId();
  const textareaDescriptionId = error
    ? errorMessageId
    : prefilledFromLastImport
      ? prefilledHintId
      : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="ds-dialog-size-lg bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Load Deck</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Paste your decklist below (e.g., &quot;4 Lightning Bolt&quot;).
          </DialogDescription>
        </DialogHeader>

        <div className="ds-dialog-scroll grid gap-4 py-1 sm:py-4">
          <div
            className={cn(
              "grid gap-4",
              curatedDecks.length > 0 && "lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
            )}
          >
            <div className="grid gap-3">
              <textarea
                ref={textareaRef}
                value={importText}
                onChange={(e) => handleImportTextChange(e.target.value)}
                placeholder={"4 Lightning Bolt\n20 Mountain..."}
                aria-describedby={textareaDescriptionId}
                aria-invalid={Boolean(error)}
                className={cn(
                  "w-full h-[min(18rem,42dvh)] sm:h-64 bg-zinc-900 border border-zinc-800 rounded-md p-3 text-base lg:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 focus:border-transparent resize-none placeholder:text-zinc-600",
                  error && "border-red-500/60 focus:ring-red-500/70",
                )}
              />

              {prefilledFromLastImport && (
                <div
                  id={prefilledHintId}
                  className="w-fit rounded-full border border-zinc-700 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-300"
                >
                  Last import loaded. Edit or paste a new decklist.
                </div>
              )}
            </div>

            {curatedDecks.length > 0 && (
              <React.Suspense fallback={null}>
                <CuratedDeckPicker
                  decks={curatedDecks}
                  activeDeckId={activeCuratedDeckId}
                  disabled={isImporting}
                  onSelectDeck={handleCuratedDeckImport}
                />
              </React.Suspense>
            )}
          </div>

          {error && (
            <div
              id={errorMessageId}
              role="alert"
              className="rounded border border-red-800/70 bg-red-950/40 p-2 text-sm text-red-200"
            >
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <GameDialogActionButton
            intent="secondary"
            onClick={handleClose}
            disabled={isImporting}
          >
            Cancel
          </GameDialogActionButton>
          <GameDialogActionButton
            onClick={handleImport}
            disabled={isImporting || !importText.trim()}
          >
            {isImporting ? "Loading..." : "Load Deck"}
          </GameDialogActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
