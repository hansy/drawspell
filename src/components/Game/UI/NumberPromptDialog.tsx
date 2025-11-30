import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

interface NumberPromptDialogProps {
  open: boolean;
  title: string;
  message?: string;
  initialValue?: number;
  onSubmit: (value: number) => void;
  onClose: () => void;
}

export const NumberPromptDialog: React.FC<NumberPromptDialogProps> = ({
  open,
  title,
  message,
  initialValue = 1,
  onSubmit,
  onClose,
}) => {
  const [value, setValue] = useState<number>(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const handleSubmit = () => {
    if (!Number.isFinite(value) || value <= 0) return;
    onSubmit(value);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[380px] bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {message && <DialogDescription className="text-zinc-400">{message}</DialogDescription>}
        </DialogHeader>
        <div className="py-4">
          <label className="text-xs font-medium text-zinc-400 mb-2 block">Value</label>
          <Input
            type="number"
            min={1}
            value={value}
            autoFocus
            onChange={(e) => setValue(parseInt(e.target.value, 10) || 0)}
            className="bg-zinc-900 border-zinc-800 text-zinc-100"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="bg-transparent border-zinc-700 hover:bg-zinc-800 text-zinc-300">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!Number.isFinite(value) || value <= 0} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
