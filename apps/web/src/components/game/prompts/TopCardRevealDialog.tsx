import React from "react";

import type { LibraryTopRevealMode } from "@/types";

import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";

interface TopCardRevealDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  onSelect: (mode: LibraryTopRevealMode) => void;
  onClose: () => void;
}

export const TopCardRevealDialog: React.FC<TopCardRevealDialogProps> = ({
  open,
  title = "Reveal top card (until turned off)",
  message = "Who should see the top card?",
  onSelect,
  onClose,
}) => {
  const handleSelect = (mode: LibraryTopRevealMode) => {
    onSelect(mode);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[400px] bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {message && (
            <DialogDescription className="text-zinc-400">
              {message}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-transparent border-zinc-700 hover:bg-zinc-800 text-zinc-300"
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleSelect("self")}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
          >
            Only me
          </Button>
          <Button
            onClick={() => handleSelect("all")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Everyone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
