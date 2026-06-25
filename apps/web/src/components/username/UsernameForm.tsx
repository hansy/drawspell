import React from 'react';
import { GameDialogActionButton } from '@/components/game/dialog/GameDialogActionButton';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { normalizeUsernameInput, USERNAME_MAX_LENGTH } from '@/store/clientPrefsStore';

type UsernameFormProps = {
  initialValue: string;
  submitLabel: string;
  onSubmit: (username: string) => void;
  autoFocusSelect?: boolean;
  highlightInitial?: boolean;
  showRandomize?: boolean;
  randomizeLabel?: string;
  onRandomize?: () => string;
  showCancel?: boolean;
  cancelLabel?: string;
  onCancel?: () => void;
};

export function UsernameForm({
  initialValue,
  submitLabel,
  onSubmit,
  autoFocusSelect = true,
  highlightInitial = true,
  showRandomize = false,
  randomizeLabel = 'Randomize',
  onRandomize,
  showCancel = false,
  cancelLabel = 'Cancel',
  onCancel,
}: UsernameFormProps) {
  const fieldId = React.useId();
  const [draft, setDraft] = React.useState(() => initialValue);
  const [highlighted, setHighlighted] = React.useState(() => highlightInitial);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!autoFocusSelect) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [autoFocusSelect]);

  const normalized = normalizeUsernameInput(draft);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalized) return;
    onSubmit(normalized);
  };

  const handleRandomize = () => {
    const next = onRandomize?.();
    if (!next) return;
    setDraft(next);
    setHighlighted(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-4">
          <label className="text-sm font-medium text-zinc-200" htmlFor={fieldId}>
            Username
          </label>
          <div className="text-xs text-zinc-400 tabular-nums">
            {Math.min(draft.length, USERNAME_MAX_LENGTH)}/{USERNAME_MAX_LENGTH}
          </div>
        </div>
        <Input
          id={fieldId}
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            if (highlighted) setHighlighted(false);
            setDraft(e.target.value);
          }}
          maxLength={USERNAME_MAX_LENGTH}
          placeholder="Your name"
          className={cn(
            'h-11',
            highlighted && 'ring-2 ring-amber-500/30 border-amber-500/50'
          )}
        />
      </div>

      <div className={cn('flex items-center gap-3', showCancel ? 'justify-between' : 'justify-end')}>
        {showRandomize && (
          <GameDialogActionButton
            type="button"
            intent="secondary"
            onClick={handleRandomize}
          >
            {randomizeLabel}
          </GameDialogActionButton>
        )}

        <div className="flex items-center gap-3">
          {showCancel && (
            <GameDialogActionButton
              type="button"
              intent="secondary"
              onClick={onCancel}
            >
              {cancelLabel}
            </GameDialogActionButton>
          )}
          <GameDialogActionButton
            type="submit"
            disabled={!normalized}
          >
            {submitLabel}
          </GameDialogActionButton>
        </div>
      </div>
    </form>
  );
}
