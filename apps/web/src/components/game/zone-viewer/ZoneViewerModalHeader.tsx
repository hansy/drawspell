import { ZONE_LABEL } from "@/constants/zones";
import type { ZoneType } from "@/types";
import { m } from "@/paraglide/messages.js";
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
  const totalLabel = totalCards === 1 ? m.zone_viewer_grouped_view_card() : m.zone_viewer_grouped_view_cards();
  const isFullLibrary = zoneType === "library" && !count;
  const title = zoneType === "library"
    ? count
      ? m.zone_viewer_modal_header_top_cards_of_library({ count: count })
      : m.zones_library()
    : m.zone_viewer_modal_header_viewer({ zoneType: ZONE_LABEL[zoneType as ZoneType] ?? zoneType });
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl first-letter:capitalize">{title}</DialogTitle>
        <DialogDescription className="text-zinc-400">
          {totalCards} {totalLabel}
          {isFullLibrary && typeof uniqueCards === "number" ? m.zone_viewer_modal_header_unique({ uniqueCards: uniqueCards }) : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 flex items-center gap-2">
        <Input
          placeholder={m.zone_viewer_modal_header_search_by_name_type_or_text()}
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
              allDisplayedCardsSelected ? m.zone_viewer_modal_header_clear_card_selection() : m.zone_viewer_modal_header_select_all_cards()
            }
            onClick={onSelectAll}
          >
            {allDisplayedCardsSelected ? m.zone_viewer_modal_header_clear_selection() : m.zone_viewer_modal_header_select_all()}
          </Button>
        )}
      </div>
    </>
  );
};
