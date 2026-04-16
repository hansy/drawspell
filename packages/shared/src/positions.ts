import {
  BASE_CARD_HEIGHT,
  CARD_ASPECT_RATIO,
  GRID_STEP_X,
  GRID_STEP_Y,
  LEGACY_BATTLEFIELD_HEIGHT,
  LEGACY_BATTLEFIELD_WIDTH,
} from "./constants/geometry";

export {
  BASE_CARD_HEIGHT,
  CARD_ASPECT_RATIO,
  GRID_STEP_X,
  GRID_STEP_Y,
  LEGACY_BATTLEFIELD_HEIGHT,
  LEGACY_BATTLEFIELD_WIDTH,
};

export const resolveBaseCardDimensions = (params?: {
  baseCardHeight?: number;
  baseCardWidth?: number;
}) => {
  const baseCardHeight = params?.baseCardHeight ?? BASE_CARD_HEIGHT;
  const baseCardWidth = params?.baseCardWidth ?? baseCardHeight * CARD_ASPECT_RATIO;
  return { baseCardHeight, baseCardWidth };
};

export const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const clamp01 = (value: number) => clampNumber(value, 0, 1);

export const clampNormalizedPosition = (position: { x: number; y: number }) => ({
  x: clamp01(position.x),
  y: clamp01(position.y),
});

export const migratePositionToNormalized = (position: { x: number; y: number }) =>
  clampNormalizedPosition({
    x: LEGACY_BATTLEFIELD_WIDTH ? position.x / LEGACY_BATTLEFIELD_WIDTH : 0,
    y: LEGACY_BATTLEFIELD_HEIGHT ? position.y / LEGACY_BATTLEFIELD_HEIGHT : 0,
  });

export const normalizeMovePosition = (
  position: { x: number; y: number } | undefined,
  fallback: { x: number; y: number }
) => {
  const normalizedInput =
    position && (position.x > 1 || position.y > 1)
      ? migratePositionToNormalized(position)
      : position;
  return clampNormalizedPosition(normalizedInput ?? fallback);
};

export const getCardPixelSize = (params?: {
  viewScale?: number;
  isTapped?: boolean;
  baseCardHeight?: number;
  baseCardWidth?: number;
}) => {
  const viewScale = params?.viewScale ?? 1;
  const isTapped = params?.isTapped ?? false;
  const { baseCardHeight, baseCardWidth } = resolveBaseCardDimensions({
    baseCardHeight: params?.baseCardHeight,
    baseCardWidth: params?.baseCardWidth,
  });
  const cardWidth = (isTapped ? baseCardHeight : baseCardWidth) * viewScale;
  const cardHeight = (isTapped ? baseCardWidth : baseCardHeight) * viewScale;
  return { cardWidth, cardHeight };
};

export const getCanonicalCardPixelSize = (params?: {
  isTapped?: boolean;
  baseCardHeight?: number;
  baseCardWidth?: number;
}) =>
  getCardPixelSize({
    isTapped: params?.isTapped,
    baseCardHeight: params?.baseCardHeight,
    baseCardWidth: params?.baseCardWidth,
    viewScale: 1,
  });

export const getNormalizedGridSteps = (params?: {
  isTapped?: boolean;
  zoneWidth?: number;
  zoneHeight?: number;
  viewScale?: number;
  baseCardHeight?: number;
  baseCardWidth?: number;
}) => {
  const { cardWidth, cardHeight } = getCardPixelSize({
    isTapped: params?.isTapped,
    viewScale: params?.viewScale,
    baseCardHeight: params?.baseCardHeight,
    baseCardWidth: params?.baseCardWidth,
  });
  const zoneWidth = params?.zoneWidth ?? LEGACY_BATTLEFIELD_WIDTH;
  const zoneHeight = params?.zoneHeight ?? LEGACY_BATTLEFIELD_HEIGHT;
  return {
    stepX: zoneWidth ? (cardWidth / 2) / zoneWidth : 0,
    stepY: zoneHeight ? (cardHeight / 4) / zoneHeight : 0,
  };
};

export const getCanonicalGridSteps = (params?: {
  isTapped?: boolean;
  zoneWidth?: number;
  zoneHeight?: number;
  baseCardHeight?: number;
  baseCardWidth?: number;
}) =>
  getNormalizedGridSteps({
    isTapped: params?.isTapped,
    zoneWidth: params?.zoneWidth,
    zoneHeight: params?.zoneHeight,
    baseCardHeight: params?.baseCardHeight,
    baseCardWidth: params?.baseCardWidth,
    viewScale: 1,
  });

export const normalizedPositionKey = (position: { x: number; y: number }) =>
  `${position.x.toFixed(4)}:${position.y.toFixed(4)}`;

const positionKey = normalizedPositionKey;

const addOccupiedPosition = (
  occupied: Set<string>,
  position: { x: number; y: number } | null | undefined
) => {
  if (!position) return;
  occupied.add(positionKey(clampNormalizedPosition(position)));
};

const createOccupiedPositionSet = <T>(
  items: Iterable<T>,
  getPosition: (item: T) => { x: number; y: number } | null | undefined
) => {
  const occupied = new Set<string>();
  for (const item of items) {
    addOccupiedPosition(occupied, getPosition(item));
  }
  return occupied;
};

export const toNormalizedPosition = (
  position: { x: number; y: number },
  zoneWidth: number = LEGACY_BATTLEFIELD_WIDTH,
  zoneHeight: number = LEGACY_BATTLEFIELD_HEIGHT
) => ({
  x: clamp01(zoneWidth ? position.x / zoneWidth : 0),
  y: clamp01(zoneHeight ? position.y / zoneHeight : 0),
});

export const fromNormalizedPosition = (
  position: { x: number; y: number },
  zoneWidth: number,
  zoneHeight: number
) => ({
  x: position.x * zoneWidth,
  y: position.y * zoneHeight,
});

const snapToGrid = (value: number, gridSize: number) => {
  if (!gridSize) return value;
  return Math.floor(value / gridSize + 0.5) * gridSize;
};

const clampCenterToZoneBounds = (
  center: { x: number; y: number },
  zoneWidth: number,
  zoneHeight: number,
  cardWidth: number,
  cardHeight: number
) => {
  const halfW = cardWidth / 2;
  const halfH = cardHeight / 2;
  const minX = halfW;
  const maxX = Math.max(halfW, zoneWidth - halfW);
  const minY = halfH;
  const maxY = Math.max(halfH, zoneHeight - halfH);

  return {
    x: Math.min(Math.max(center.x, minX), maxX),
    y: Math.min(Math.max(center.y, minY), maxY),
  };
};

export const snapNormalizedWithZone = (
  position: { x: number; y: number },
  zoneWidth: number,
  zoneHeight: number,
  cardWidth: number,
  cardHeight: number
) => {
  if (!zoneWidth || !zoneHeight) return clampNormalizedPosition(position);

  const asPixels = fromNormalizedPosition(position, zoneWidth, zoneHeight);
  const gridX = cardWidth / 2;
  const gridY = cardHeight / 4;
  const left = asPixels.x - cardWidth / 2;
  const top = asPixels.y - cardHeight / 2;
  const snappedLeft = snapToGrid(left, gridX);
  const snappedTop = snapToGrid(top, gridY);
  const snappedCenter = {
    x: snappedLeft + cardWidth / 2,
    y: snappedTop + cardHeight / 2,
  };

  const clampedPixels = clampCenterToZoneBounds(
    snappedCenter,
    zoneWidth,
    zoneHeight,
    cardWidth,
    cardHeight
  );
  return toNormalizedPosition(clampedPixels, zoneWidth, zoneHeight);
};

/**
 * Mirror a normalized position vertically (flip Y in [0,1]).
 * Useful for rendering an opponent's battlefield from your perspective
 * while keeping stored coordinates canonical.
 */
export const mirrorNormalizedY = (position: { x: number; y: number }) =>
  clampNormalizedPosition({
    x: position.x,
    y: 1 - position.y,
  });

export const positionsRoughlyEqual = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  epsilon = 1e-4
) => Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;

export const resolvePositionAgainstOccupied = ({
  targetPosition,
  occupied,
  maxAttempts,
  stepY = GRID_STEP_Y,
}: {
  targetPosition: { x: number; y: number };
  occupied: Set<string>;
  maxAttempts: number;
  stepY?: number;
}) => {
  const clampedTarget = clampNormalizedPosition(targetPosition);
  let candidate = clampedTarget;
  let attempts = 0;

  while (occupied.has(positionKey(candidate)) && attempts < maxAttempts) {
    candidate = clampNormalizedPosition({ x: candidate.x, y: candidate.y + stepY });
    attempts += 1;
  }

  if (attempts >= maxAttempts) return clampedTarget;
  return candidate;
};

export const resolveBattlefieldCollisionPosition = ({
  movingCardId,
  targetPosition,
  orderedCardIds,
  getPosition,
  stepY = GRID_STEP_Y,
  maxAttempts = 200,
}: {
  movingCardId: string;
  targetPosition: { x: number; y: number };
  orderedCardIds: string[];
  getPosition: (cardId: string) => { x: number; y: number } | null | undefined;
  stepY?: number;
  maxAttempts?: number;
}) => {
  const occupied = createOccupiedPositionSet(
    orderedCardIds,
    (id) => (id === movingCardId ? null : getPosition(id))
  );

  return resolvePositionAgainstOccupied({
    targetPosition,
    occupied,
    maxAttempts,
    stepY,
  });
};

export const resolveBattlefieldGroupCollisionPositions = ({
  movingCardIds,
  targetPositions,
  orderedCardIds,
  getPosition,
  getStepY,
  stepY = GRID_STEP_Y,
  maxAttempts = 200,
}: {
  movingCardIds: string[];
  targetPositions: Record<string, { x: number; y: number } | undefined>;
  orderedCardIds: string[];
  getPosition: (cardId: string) => { x: number; y: number } | null | undefined;
  getStepY?: (cardId: string) => number | undefined;
  stepY?: number;
  maxAttempts?: number;
}) => {
  if (movingCardIds.length === 0) return {} as Record<string, { x: number; y: number }>;

  const movingSet = new Set(movingCardIds);
  const otherIds = orderedCardIds.filter((id) => !movingSet.has(id));
  const occupied = createOccupiedPositionSet(otherIds, getPosition);

  const resolved: Record<string, { x: number; y: number }> = {};
  const orderedMovingIds = movingCardIds.filter((id) => Boolean(targetPositions[id]));

  orderedMovingIds.forEach((id) => {
    const target = targetPositions[id];
    if (!target) return;
    const next = resolvePositionAgainstOccupied({
      targetPosition: target,
      occupied,
      maxAttempts,
      stepY: getStepY?.(id) ?? stepY,
    });
    resolved[id] = next;
    occupied.add(positionKey(next));
  });

  return resolved;
};

export const bumpPosition = (
  position: { x: number; y: number },
  dx: number = GRID_STEP_X,
  dy: number = GRID_STEP_Y
) => clampNormalizedPosition({ x: position.x + dx, y: position.y + dy });

export const offsetNormalizedByGrid = (params: {
  position: { x: number; y: number };
  stepsX?: number;
  stepsY?: number;
  isTapped?: boolean;
  zoneWidth?: number;
  zoneHeight?: number;
  baseCardHeight?: number;
  baseCardWidth?: number;
}) => {
  const { stepX, stepY } = getCanonicalGridSteps({
    isTapped: params.isTapped,
    zoneWidth: params.zoneWidth,
    zoneHeight: params.zoneHeight,
    baseCardHeight: params.baseCardHeight,
    baseCardWidth: params.baseCardWidth,
  });
  return {
    stepX,
    stepY,
    position: clampNormalizedPosition({
      x: params.position.x + stepX * (params.stepsX ?? 1),
      y: params.position.y + stepY * (params.stepsY ?? 1),
    }),
  };
};

export const findAvailablePositionNormalized = (
  start: { x: number; y: number },
  zoneCardIds: string[],
  cards: Record<string, { position: { x: number; y: number } }>,
  stepX: number = GRID_STEP_X,
  stepY: number = GRID_STEP_Y,
  maxChecks: number = 50
) => {
  const occupied = createOccupiedPositionSet(zoneCardIds, (id) => cards[id]?.position);

  let candidate = clampNormalizedPosition(start);
  let attempts = 0;
  while (occupied.has(positionKey(candidate)) && attempts < maxChecks) {
    candidate = clampNormalizedPosition({ x: candidate.x + stepX, y: candidate.y + stepY });
    attempts += 1;
  }

  return candidate;
};
