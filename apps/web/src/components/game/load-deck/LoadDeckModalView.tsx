import React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
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
                className={cn(
                  "w-full h-[min(18rem,42dvh)] sm:h-64 bg-zinc-900 border border-zinc-800 rounded-md p-3 text-base lg:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 focus:border-transparent resize-none placeholder:text-zinc-600",
                  prefilledFromLastImport &&
                    "ring-2 ring-amber-500/30 border-amber-500/50",
                )}
              />

              {prefilledFromLastImport && (
                <div className="text-amber-200/80 text-xs bg-amber-950/30 p-2 rounded border border-amber-900/50">
                  Loaded your last imported deck — paste to replace.
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
            <div className="text-red-400 text-sm bg-red-950/30 p-2 rounded border border-red-900/50">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isImporting}
            className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || !importText.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {isImporting ? "Loading..." : "Load Deck"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
