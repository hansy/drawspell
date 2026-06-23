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
          <textarea
            ref={textareaRef}
            value={importText}
            onChange={(e) => handleImportTextChange(e.target.value)}
            placeholder={"4 Lightning Bolt\n20 Mountain..."}
            aria-describedby={textareaDescriptionId}
            aria-invalid={Boolean(error)}
            className={cn(
              "w-full h-[min(18rem,42dvh)] sm:h-64 bg-zinc-900 border border-zinc-800 rounded-md p-3 text-base lg:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none placeholder:text-zinc-600",
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
