import { flushSync } from "react-dom";

export const commitDragFrameStoreUpdate = (update: () => void) => {
  queueMicrotask(() => {
    flushSync(update);
  });
};
