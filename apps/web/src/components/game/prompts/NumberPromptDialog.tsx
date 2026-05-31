import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { cn } from "@/lib/utils";

interface NumberPromptDialogProps {
  open: boolean;
  title: string;
  message?: string;
  initialValue?: number;
  minValue?: number;
  maxValue?: number;
  inputLabel?: string;
  showMaxButton?: boolean;
  confirmLabel?: string;
  onSubmit: (value: number) => void;
  onClose: () => void;
}

export const NumberPromptDialog: React.FC<NumberPromptDialogProps> = ({
  open,
  title,
  message,
  initialValue = 1,
  minValue = 1,
  maxValue,
  inputLabel = "Value",
  showMaxButton = false,
  confirmLabel,
  onSubmit,
  onClose,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState<string>(String(initialValue));

  useEffect(() => {
    if (!open) return;
    setValue(String(initialValue));

    // Ensure the default value is selected so the user can type immediately.
    queueMicrotask(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
  }, [open, initialValue]);

  const handleSubmit = () => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < minValue) return;
    if (typeof maxValue === "number" && parsed > maxValue) return;
    onSubmit(parsed);
    onClose();
  };

  const parsedValue = Number.parseInt(value, 10);
  const isValid =
    Number.isFinite(parsedValue) &&
    parsedValue >= minValue &&
    (typeof maxValue !== "number" || parsedValue <= maxValue);
  const canUseMax = showMaxButton && typeof maxValue === "number" && Number.isFinite(maxValue);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="ds-dialog-size-xs bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {message && <DialogDescription className="text-zinc-400">{message}</DialogDescription>}
        </DialogHeader>
        <div className="py-4">
          <label className="text-xs font-medium text-zinc-400 mb-2 block">{inputLabel}</label>
          <div className="relative">
            <Input
              ref={inputRef}
              inputMode="numeric"
              pattern="[0-9]*"
              value={value}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                const next = e.target.value;
                if (next === "" || /^\d+$/.test(next)) setValue(next);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className={cn(
                "bg-zinc-900 border-zinc-800 text-zinc-100",
                canUseMax && "pr-16"
              )}
              max={maxValue}
              min={minValue}
            />
            {canUseMax && (
              <button
                type="button"
                onClick={() => {
                  setValue(String(maxValue));
                  queueMicrotask(() => inputRef.current?.focus());
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-200 hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300"
              >
                Max
              </button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="bg-transparent border-zinc-700 hover:bg-zinc-800 text-zinc-300">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
