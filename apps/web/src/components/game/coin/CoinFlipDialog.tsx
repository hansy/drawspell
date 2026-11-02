import { m } from "@/paraglide/messages.js";
import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { GameDialogActionButton } from "@/components/game/dialog/GameDialogActionButton";
import { MAX_RANDOM_COUNT } from "@mtg/shared/constants/limits";

export type CoinFlipDialogProps = {
  open: boolean;
  onClose: () => void;
  onFlip: (params: { count: number }) => void;
};

const DEFAULT_COUNT = 1;

export const CoinFlipDialog: React.FC<CoinFlipDialogProps> = ({ open, onClose, onFlip }) => {
  const countRef = React.useRef<HTMLInputElement | null>(null);
  const countId = React.useId();
  const [count, setCount] = React.useState<string>(String(DEFAULT_COUNT));

  React.useEffect(() => {
    if (!open) return;
    setCount(String(DEFAULT_COUNT));

    queueMicrotask(() => {
      const el = countRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
  }, [open]);

  const parsedCount = Number.parseInt(count, 10);
  const isValid =
    Number.isFinite(parsedCount) && parsedCount > 0 && parsedCount <= MAX_RANDOM_COUNT;

  const handleSubmit = () => {
    if (!isValid) return;
    onFlip({ count: parsedCount });
    onClose();
  };

  const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    if (next === "" || /^\d+$/.test(next)) setCount(next);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="ds-dialog-size-xs bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>{m.coin_flip_dialog_flip_coin()}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {m.coin_flip_dialog_choose_how_many_coins_to_flip_each_coin_will_land_on_heads_or_tai()}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label
              htmlFor={countId}
              className="block text-sm font-medium text-zinc-300"
            >
              {m.coin_flip_dialog_number_of_coins()}</label>
            <Input
              id={countId}
              ref={countRef}
              inputMode="numeric"
              pattern="[0-9]*"
              value={count}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onChange={handleNumericChange}
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
            {m.coin_flip_dialog_flip()}</GameDialogActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
