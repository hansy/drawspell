import type { CommandEnvelope, SignedSnapshot } from "./types";
import type * as Y from "yjs";

import { getActiveHandles, getActiveSessionId } from "@/yjs/docManager";

export const getActiveCommandLog = (): {
  sessionId: string;
  commands: Y.Array<CommandEnvelope>;
  snapshots: Y.Array<SignedSnapshot>;
} | null => {
  const sessionId = getActiveSessionId();
  const handles = getActiveHandles();
  if (!sessionId || !handles) return null;
  return { sessionId, commands: handles.commands, snapshots: handles.snapshots };
};
