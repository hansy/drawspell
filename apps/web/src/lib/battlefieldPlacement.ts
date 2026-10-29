import {
  BASE_CARD_HEIGHT,
  CARD_ASPECT_RATIO,
  LEGACY_BATTLEFIELD_HEIGHT,
  LEGACY_BATTLEFIELD_WIDTH,
} from "@mtg/shared/constants/geometry";
import {
  snapNormalizedToBattlefieldPlacementGrid,
  type Position,
} from "@mtg/shared/positions";

const CARD_WIDTH = (BASE_CARD_HEIGHT * CARD_ASPECT_RATIO) / LEGACY_BATTLEFIELD_WIDTH;
const CARD_HEIGHT = BASE_CARD_HEIGHT / LEGACY_BATTLEFIELD_HEIGHT;

// Where a card played without a drop point should go: to the right of every
// card that overlaps the front row, instead of piling up at the battlefield origin.
export const nextOpenBattlefieldPosition = (occupied: Position[]): Position => {
  if (occupied.length === 0) return { x: 0, y: 0 };
  const rowY = Math.min(...occupied.map((position) => position.y));
  const rowX = occupied
    .filter((position) => Math.abs(position.y - rowY) < CARD_HEIGHT)
    .map((position) => position.x);
  return snapNormalizedToBattlefieldPlacementGrid({
    x: Math.max(...rowX) + CARD_WIDTH * 1.1,
    y: rowY,
  });
};
