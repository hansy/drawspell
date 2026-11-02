import { m } from "@/paraglide/messages.js";
import React from "react";
import { Loader2 } from "lucide-react";

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

export const CuratedDeckPickerLoading = () => (
  <section
    role="status"
    aria-label={m.load_deck_modal_view_loading_curated_decks()}
    className="grid h-[min(18rem,42dvh)] grid-rows-[auto_minmax(0,1fr)] gap-3 sm:h-64"
  >
    <div className="h-5 w-28 rounded bg-zinc-800 motion-safe:animate-pulse" />
    <div className="grid min-h-0 content-start gap-3 pt-2">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          aria-hidden="true"
          className="h-[3.75rem] rounded-md bg-zinc-900 motion-safe:animate-pulse"
        />
      ))}
    </div>
  </section>
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
      <DialogContent className="ds-dialog-size-lg grid h-[100dvh] grid-rows-[auto_minmax(0,1fr)_auto] bg-zinc-950 border-zinc-800 text-zinc-100 lg:h-auto">
        <DialogHeader>
          <DialogTitle>{m.load_deck_modal_view_load_deck()}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {m.load_deck_modal_view_paste_a_decklist_e_g_4_lightning_bolt_or_an_archidekt_deck_link()}</DialogDescription>
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
                placeholder={m.load_deck_modal_view_4_lightning_bolt_20_mountain()}
                aria-describedby={textareaDescriptionId}
                aria-invalid={Boolean(error)}
                className={cn(
                  "w-full h-[min(14rem,34dvh)] sm:h-56 bg-zinc-900 border border-zinc-800 rounded-md p-3 text-base lg:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 focus:border-transparent resize-none placeholder:text-zinc-600",
                  error && "border-red-500/60 focus:ring-red-500/70",
                )}
              />

              {prefilledFromLastImport && (
                <div
                  id={prefilledHintId}
                  className="w-fit rounded-full border border-zinc-700 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-300"
                >
                  {m.load_deck_modal_view_last_import_loaded_edit_or_paste_a_new_decklist()}</div>
              )}
            </div>

            {curatedDecks.length > 0 && (
              <React.Suspense fallback={<CuratedDeckPickerLoading />}>
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

        <DialogFooter className="border-t border-zinc-800 bg-zinc-950 pt-3 pb-[env(safe-area-inset-bottom)] sm:pb-0">
          <GameDialogActionButton
            intent="secondary"
            onClick={handleClose}
            disabled={isImporting}
          >
            {m.cancel()}</GameDialogActionButton>
          <GameDialogActionButton
            onClick={handleImport}
            disabled={isImporting || !importText.trim()}
            aria-busy={isImporting}
          >
            {isImporting ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className="motion-safe:animate-spin"
                />
                {m.load_deck_modal_view_loading_deck()}</>
            ) : (
              m.load_deck_modal_view_load_deck()
            )}
          </GameDialogActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
