import { m } from "@/paraglide/messages.js";
import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { GameDialogActionButton } from "@/components/game/dialog/GameDialogActionButton";
import { MAX_DICE_SIDES, MAX_RANDOM_COUNT } from "@mtg/shared/constants/limits";

export type DiceRollDialogProps = {
  open: boolean;
  onClose: () => void;
  onRoll: (params: { sides: number; count: number }) => void;
};

const DEFAULT_SIDES = 20;
const DEFAULT_COUNT = 1;

export const DiceRollDialog: React.FC<DiceRollDialogProps> = ({ open, onClose, onRoll }) => {
  const sidesRef = React.useRef<HTMLInputElement | null>(null);
  const sidesId = React.useId();
  const countId = React.useId();
  const [sides, setSides] = React.useState<string>(String(DEFAULT_SIDES));
  const [count, setCount] = React.useState<string>(String(DEFAULT_COUNT));

  React.useEffect(() => {
    if (!open) return;
    setSides(String(DEFAULT_SIDES));
    setCount(String(DEFAULT_COUNT));

    queueMicrotask(() => {
      const el = sidesRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
  }, [open]);

  const parsedSides = Number.parseInt(sides, 10);
  const parsedCount = Number.parseInt(count, 10);
  const isValid =
    Number.isFinite(parsedSides) &&
    parsedSides >= 2 &&
    parsedSides <= MAX_DICE_SIDES &&
    Number.isFinite(parsedCount) &&
    parsedCount > 0 &&
    parsedCount <= MAX_RANDOM_COUNT;

  const handleSubmit = () => {
    if (!isValid) return;
    onRoll({ sides: parsedSides, count: parsedCount });
    onClose();
  };

  const handleNumericChange = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    if (next === "" || /^\d+$/.test(next)) setter(next);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="ds-dialog-size-xs bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>{m.dice_roll_dialog_roll_dice()}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {m.dice_roll_dialog_choose_the_number_of_sides_and_how_many_dice_to_roll_defaults_to()}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1 sm:py-4">
          <div className="grid grid-cols-1 gap-4 items-end sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <label
                htmlFor={sidesId}
                className="block text-sm font-medium text-zinc-300"
              >
                {m.dice_roll_dialog_number_of_sides()}</label>
              <Input
                id={sidesId}
                ref={sidesRef}
                inputMode="numeric"
                pattern="[0-9]*"
                value={sides}
                autoFocus
                onFocus={(e) => e.currentTarget.select()}
                onChange={handleNumericChange(setSides)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                className="bg-zinc-900 border-zinc-800 text-zinc-100"
              />
            </div>

            <div className="space-y-2 w-full sm:w-32">
              <label
                htmlFor={countId}
                className="block text-sm font-medium text-zinc-300"
              >
                {m.dice_roll_dialog_dice_count()}</label>
              <Input
                id={countId}
                inputMode="numeric"
                pattern="[0-9]*"
                value={count}
                onFocus={(e) => e.currentTarget.select()}
                onChange={handleNumericChange(setCount)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                className="bg-zinc-900 border-zinc-800 text-zinc-100"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <GameDialogActionButton
            intent="secondary"
            onClick={onClose}
          >
            {m.cancel()}</GameDialogActionButton>
          <GameDialogActionButton
            onClick={handleSubmit}
            disabled={!isValid}
          >
            {m.dice_roll_dialog_roll()}</GameDialogActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
