import type { LogEventDefinition, LogEventId } from "./types";

import { cardEvents } from "./eventRegistry/cardEvents";
import { counterEvents } from "./eventRegistry/counterEvents";
import { deckEvents } from "./eventRegistry/deckEvents";
import { libraryEvents } from "./eventRegistry/libraryEvents";
import { playerEvents } from "./eventRegistry/playerEvents";

export const logEventRegistry: Record<LogEventId, LogEventDefinition<any>> = {
  ...playerEvents,
  ...libraryEvents,
  ...deckEvents,
  ...cardEvents,
  ...counterEvents,
};

