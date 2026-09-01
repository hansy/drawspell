import type { CardId, PlayerId, ZoneId } from "@/types";
import type { CardMovementOptions } from "@mtg/shared/movement";

export type ContextMenuMoveCardFn = (
  cardId: CardId,
  toZoneId: ZoneId,
  position?: { x: number; y: number },
  actorId?: PlayerId,
  isRemote?: boolean,
  opts?: CardMovementOptions
) => void;
