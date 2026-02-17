import React from "react";

import { DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";

export interface ZoneViewerModalHeaderProps {
  zoneType: string;
  totalCards: number;
  count?: number;
  filterText: string;
  onFilterTextChange: (text: string) => void;
}

export const ZoneViewerModalHeader: React.FC<ZoneViewerModalHeaderProps> = ({
  zoneType,
  totalCards,
  filterText,
  onFilterTextChange,
}) => {
  const totalLabel = totalCards === 1 ? "card" : "cards";
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl capitalize">{zoneType} Viewer</DialogTitle>
        <DialogDescription className="text-zinc-400">
          {totalCards} {totalLabel}
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
