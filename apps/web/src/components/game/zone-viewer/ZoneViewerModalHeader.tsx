import React from "react";

import { DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";

export interface ZoneViewerModalHeaderProps {
  zoneType: string;
  totalCards: number;
  count?: number;
  uniqueCards?: number;
  filterText: string;
  onFilterTextChange: (text: string) => void;
  showSelectAll?: boolean;
  selectAllDisabled?: boolean;
  allDisplayedCardsSelected?: boolean;
  onSelectAll?: () => void;
}

export const ZoneViewerModalHeader: React.FC<ZoneViewerModalHeaderProps> = ({
  zoneType,
  totalCards,
  count,
  uniqueCards,
  filterText,
  onFilterTextChange,
  showSelectAll = false,
  selectAllDisabled = false,
  allDisplayedCardsSelected = false,
  onSelectAll,
}) => {
  const totalLabel = totalCards === 1 ? "card" : "cards";
  const isFullLibrary = zoneType === "library" && !count;
  const title = zoneType === "library"
    ? count
      ? `Top ${count} cards of Library`
      : "Library"
    : `${zoneType} Viewer`;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl first-letter:capitalize">{title}</DialogTitle>
        <DialogDescription className="text-zinc-400">
          {totalCards} {totalLabel}
          {isFullLibrary && typeof uniqueCards === "number" ? ` · ${uniqueCards} unique` : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 flex items-center gap-2">
        <Input
          placeholder="Search by name, type, or text..."
          value={filterText}
          onChange={(e) => onFilterTextChange(e.target.value)}
          className="min-w-0 flex-1 bg-zinc-900 border-zinc-800 focus:ring-indigo-500"
        />
        {showSelectAll && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white"
            disabled={selectAllDisabled}
            aria-label={
              allDisplayedCardsSelected ? "Clear card selection" : "Select all cards"
            }
            onClick={onSelectAll}
          >
            {allDisplayedCardsSelected ? "Clear selection" : "Select all"}
          </Button>
        )}
      </div>
    </>
  );
};
