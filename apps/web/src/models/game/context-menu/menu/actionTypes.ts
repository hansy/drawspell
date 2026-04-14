import type { CardId, FaceDownMode, PlayerId, ZoneId } from "@/types";

export type ContextMenuMoveCardFn = (
  cardId: CardId,
  toZoneId: ZoneId,
  position?: { x: number; y: number },
  actorId?: PlayerId,
  isRemote?: boolean,
  opts?: {
    suppressLog?: boolean;
    faceDown?: boolean;
    faceDownMode?: FaceDownMode;
    skipCollision?: boolean;
  }
) => void;
