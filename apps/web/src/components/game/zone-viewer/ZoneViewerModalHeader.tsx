import React from "react";

import { DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";

export interface ZoneViewerModalHeaderProps {
  zoneType: string;
  totalCards: number;
  count?: number;
  uniqueCards?: number;
  filterText: string;
  onFilterTextChange: (text: string) => void;
}

export const ZoneViewerModalHeader: React.FC<ZoneViewerModalHeaderProps> = ({
  zoneType,
  totalCards,
  count,
  uniqueCards,
  filterText,
  onFilterTextChange,
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

      <div className="mt-4">
        <Input
          placeholder="Search by name, type, or text..."
          value={filterText}
          onChange={(e) => onFilterTextChange(e.target.value)}
          className="bg-zinc-900 border-zinc-800 focus:ring-indigo-500"
        />
      </div>
    </>
  );
};
