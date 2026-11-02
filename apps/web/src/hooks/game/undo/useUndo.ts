import { m } from "@/paraglide/messages.js";
import * as React from "react";
import { toast } from "sonner";

import { isTypingTarget } from "@/hooks/game/shortcuts/model";
import { undoLastAction, useUndoStore } from "@/store/gameStore/undo";

export const performUndo = () => {
  const result = undoLastAction();
  if (!result.label) {
    toast(m.use_undo_nothing_to_undo());
    return;
  }
  if (!result.undone) {
    toast.error(m.use_undo_can_t_undo_it_changed_since({ label: result.label }));
    return;
  }
  toast(m.use_undo_undid({ label: result.label }));
};

// Cmd+Z / Ctrl+Z, ignored while typing. The undo history belongs to one room.
export const useUndo = (sessionId: string, enabled: boolean) => {
  React.useEffect(() => {
    useUndoStore.getState().clear();
  }, [sessionId]);

  React.useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== "z") return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      performUndo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
};
