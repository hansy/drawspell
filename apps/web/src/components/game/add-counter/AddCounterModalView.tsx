import React from "react";

import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { GameDialogActionButton } from "@/components/game/dialog/GameDialogActionButton";
import { cn } from "@/lib/utils";

import type { AddCounterController } from "@/hooks/game/add-counter/useAddCounterController";

export const AddCounterModalView: React.FC<AddCounterController> = ({
  isOpen,
  handleClose,
  counterType,
  handleCounterTypeChange,
  handleSelectType,
  count,
  handleCountChange,
  quickSelect,
  canSubmit,
  handleAdd,
}) => {
  const counterNameId = React.useId();
  const countId = React.useId();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="ds-dialog-size-xs bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Add Counter</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-1 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <div className="flex-1">
              <label
                htmlFor={counterNameId}
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Counter name
              </label>
              <Input
                id={counterNameId}
                value={counterType}
                onChange={(e) => handleCounterTypeChange(e.target.value)}
                maxLength={64}
                className="bg-zinc-800 border-zinc-700 w-full"
                placeholder="e.g. +1/+1, Poison"
                autoFocus
              />
            </div>

            <div className="w-full sm:w-24">
              <label
                htmlFor={countId}
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Count
              </label>
              <Input
                id={countId}
                type="number"
                min={1}
                value={count}
                onChange={(e) => handleCountChange(e.target.value)}
                className="bg-zinc-800 border-zinc-700 w-full"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-zinc-300">
              Quick select
            </div>
            <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto p-1">
              {quickSelect.map((item) => (
                <Button
                  key={item.type}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectType(item.type)}
                  className={cn(
                    "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white",
                    item.isSelected &&
                      "border-indigo-400/70 bg-indigo-500/15 text-white ring-1 ring-indigo-400/60"
                  )}
                >
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.type}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <GameDialogActionButton
            intent="secondary"
            onClick={handleClose}
          >
            Cancel
          </GameDialogActionButton>
          <GameDialogActionButton
            onClick={handleAdd}
            disabled={!canSubmit}
          >
            Add Counter
          </GameDialogActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
