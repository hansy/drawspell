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

export type Position = { x: number; y: number };

type CardDimensionOptions = {
  baseCardHeight?: number;
  baseCardWidth?: number;
};

type CardOrientationOptions = {
  isTapped?: boolean;
};

type ZoneDimensionOptions = {
  zoneWidth?: number;
  zoneHeight?: number;
};

type ViewScaleOptions = {
  viewScale?: number;
};

type BattlefieldPlacementGridOptions = ZoneDimensionOptions &
  ViewScaleOptions &
  CardDimensionOptions;

export const resolveBaseCardDimensions = (params?: CardDimensionOptions) => {
  const baseCardHeight = params?.baseCardHeight ?? BASE_CARD_HEIGHT;
  const baseCardWidth = params?.baseCardWidth ?? baseCardHeight * CARD_ASPECT_RATIO;
  return { baseCardHeight, baseCardWidth };
};

export const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const clamp01 = (value: number) => clampNumber(value, 0, 1);

export const clampNormalizedPosition = (position: Position) => ({
  x: clamp01(position.x),
  y: clamp01(position.y),
});

export const migratePositionToNormalized = (position: Position) =>
  clampNormalizedPosition({
    x: LEGACY_BATTLEFIELD_WIDTH ? position.x / LEGACY_BATTLEFIELD_WIDTH : 0,
    y: LEGACY_BATTLEFIELD_HEIGHT ? position.y / LEGACY_BATTLEFIELD_HEIGHT : 0,
  });

export const normalizeMovePosition = (
  position: Position | undefined,
  fallback: Position
) => {
  const normalizedInput =
    position && (position.x > 1 || position.y > 1)
      ? migratePositionToNormalized(position)
      : position;
  return clampNormalizedPosition(normalizedInput ?? fallback);
};

export const getCardPixelSize = (
  params?: CardOrientationOptions & ViewScaleOptions & CardDimensionOptions
) => {
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

export const getCanonicalCardPixelSize = (
  params?: CardOrientationOptions & CardDimensionOptions
) =>
  getCardPixelSize({
    isTapped: params?.isTapped,
    baseCardHeight: params?.baseCardHeight,
    baseCardWidth: params?.baseCardWidth,
    viewScale: 1,
  });

export const getNormalizedGridSteps = (
  params?: CardOrientationOptions &
    ZoneDimensionOptions &
    ViewScaleOptions &
    CardDimensionOptions
) => {
  const { cardWidth, cardHeight } = getCardPixelSize({
    isTapped: params?.isTapped,
    viewScale: params?.viewScale,
    baseCardHeight: params?.baseCardHeight,
    baseCardWidth: params?.baseCardWidth,
  });
  const zoneWidth = params?.zoneWidth ?? LEGACY_BATTLEFIELD_WIDTH;
  const zoneHeight = params?.zoneHeight ?? LEGACY_BATTLEFIELD_HEIGHT;
  return {
    stepX: zoneWidth ? cardWidth / zoneWidth : 0,
    stepY: zoneHeight ? (cardHeight / 4) / zoneHeight : 0,
  };
};

export const getCanonicalGridSteps = (
  params?: CardOrientationOptions & ZoneDimensionOptions & CardDimensionOptions
) =>
  getNormalizedGridSteps({
    isTapped: params?.isTapped,
    zoneWidth: params?.zoneWidth,
    zoneHeight: params?.zoneHeight,
    baseCardHeight: params?.baseCardHeight,
    baseCardWidth: params?.baseCardWidth,
    viewScale: 1,
  });

export const getCanonicalBattlefieldGridSteps = (params?: CardOrientationOptions) =>
  getCanonicalGridSteps({
    isTapped: params?.isTapped,
    zoneWidth: LEGACY_BATTLEFIELD_WIDTH,
    zoneHeight: LEGACY_BATTLEFIELD_HEIGHT,
    baseCardHeight: BASE_CARD_HEIGHT,
    baseCardWidth: BASE_CARD_HEIGHT * CARD_ASPECT_RATIO,
  });

export const BATTLEFIELD_PLACEMENT_GRID_WIDTH_FRACTION = 1 / 2;
export const BATTLEFIELD_PLACEMENT_GRID_SHORT_SIDE_FRACTION = 1 / 2;

const snapNormalizedValueToStep = (value: number, step: number) =>
  step > 0 ? Math.round(value / step) * step : value;

export const getCanonicalBattlefieldPlacementGridSteps = (
  params?: BattlefieldPlacementGridOptions
) => {
  const { baseCardWidth } = resolveBaseCardDimensions({
    baseCardHeight: params?.baseCardHeight,
    baseCardWidth: params?.baseCardWidth,
  });
  const zoneWidth = params?.zoneWidth ?? LEGACY_BATTLEFIELD_WIDTH;
  const zoneHeight = params?.zoneHeight ?? LEGACY_BATTLEFIELD_HEIGHT;
  const viewScale = params?.viewScale ?? 1;

  return {
    stepX: zoneWidth
      ? (baseCardWidth * viewScale * BATTLEFIELD_PLACEMENT_GRID_WIDTH_FRACTION) /
        zoneWidth
      : 0,
    stepY: zoneHeight
      ? (baseCardWidth * viewScale * BATTLEFIELD_PLACEMENT_GRID_SHORT_SIDE_FRACTION) /
        zoneHeight
      : 0,
  };
};

export const snapNormalizedToBattlefieldPlacementGrid = (
  position: Position,
  params?: Parameters<typeof getCanonicalBattlefieldPlacementGridSteps>[0]
) => {
  const { stepX, stepY } = getCanonicalBattlefieldPlacementGridSteps(params);
  return clampNormalizedPosition({
    x: snapNormalizedValueToStep(position.x, stepX),
    y: snapNormalizedValueToStep(position.y, stepY),
  });
};

export const normalizedPositionKey = (position: Position) =>
  `${position.x.toFixed(4)}:${position.y.toFixed(4)}`;

const addOccupiedPositionKey = (
  occupied: Set<string>,
  position: Position | null | undefined
) => {
  if (!position) return;
  occupied.add(normalizedPositionKey(clampNormalizedPosition(position)));
};

const createOccupiedPositionSet = <T>(
  items: Iterable<T>,
  getPosition: (item: T) => Position | null | undefined
) => {
  const occupied = new Set<string>();
  for (const item of items) {
    addOccupiedPositionKey(occupied, getPosition(item));
  }
  return occupied;
};

export const toNormalizedPosition = (
  position: Position,
  zoneWidth: number = LEGACY_BATTLEFIELD_WIDTH,
  zoneHeight: number = LEGACY_BATTLEFIELD_HEIGHT
) => ({
  x: clamp01(zoneWidth ? position.x / zoneWidth : 0),
  y: clamp01(zoneHeight ? position.y / zoneHeight : 0),
});

export const fromNormalizedPosition = (
  position: Position,
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
  center: Position,
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
  position: Position,
  zoneWidth: number,
  zoneHeight: number,
  cardWidth: number,
  cardHeight: number
) => {
  if (!zoneWidth || !zoneHeight) return clampNormalizedPosition(position);

  const asPixels = fromNormalizedPosition(position, zoneWidth, zoneHeight);
  const gridX = cardWidth;
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

export const snapNormalizedToCanonicalBattlefieldGrid = (
  position: Position,
  params?: CardOrientationOptions
) => {
  const { cardWidth, cardHeight } = getCanonicalCardPixelSize({
    isTapped: params?.isTapped,
    baseCardHeight: BASE_CARD_HEIGHT,
    baseCardWidth: BASE_CARD_HEIGHT * CARD_ASPECT_RATIO,
  });
  return snapNormalizedWithZone(
    position,
    LEGACY_BATTLEFIELD_WIDTH,
    LEGACY_BATTLEFIELD_HEIGHT,
    cardWidth,
    cardHeight
  );
};

export const getCanonicalBattlefieldCardBounds = (
  params?: CardOrientationOptions
) => {
  const { cardWidth, cardHeight } = getCanonicalCardPixelSize({
    isTapped: params?.isTapped,
    baseCardHeight: BASE_CARD_HEIGHT,
    baseCardWidth: BASE_CARD_HEIGHT * CARD_ASPECT_RATIO,
  });
  const halfW = cardWidth / 2 / LEGACY_BATTLEFIELD_WIDTH;
  const halfH = cardHeight / 2 / LEGACY_BATTLEFIELD_HEIGHT;
  return {
    minX: halfW,
    maxX: 1 - halfW,
    minY: halfH,
    maxY: 1 - halfH,
  };
};

export const clampNormalizedToCanonicalBattlefieldBounds = (
  position: Position,
  params?: CardOrientationOptions
) => {
  const bounds = getCanonicalBattlefieldCardBounds({
    isTapped: params?.isTapped,
  });
  return {
    x: clampNumber(position.x, bounds.minX, bounds.maxX),
    y: clampNumber(position.y, bounds.minY, bounds.maxY),
  };
};

export const clampCanonicalBattlefieldGroupDelta = <T extends string>(params: {
  movingIds: T[];
  startPositions: Record<T, Position | undefined>;
  delta: Position;
  isTapped?: (id: T) => boolean | undefined;
}) => {
  let minDx = -Infinity;
  let maxDx = Infinity;
  let minDy = -Infinity;
  let maxDy = Infinity;

  params.movingIds.forEach((id) => {
    const start = params.startPositions[id];
    if (!start) return;
    const bounds = getCanonicalBattlefieldCardBounds({
      isTapped: params.isTapped?.(id),
    });
    minDx = Math.max(minDx, bounds.minX - start.x);
    maxDx = Math.min(maxDx, bounds.maxX - start.x);
    minDy = Math.max(minDy, bounds.minY - start.y);
    maxDy = Math.min(maxDy, bounds.maxY - start.y);
  });

  return {
    x: clampNumber(params.delta.x, minDx, maxDx),
    y: clampNumber(params.delta.y, minDy, maxDy),
  };
};

/**
 * Mirror a normalized position vertically (flip Y in [0,1]).
 * Useful for rendering an opponent's battlefield from your perspective
 * while keeping stored coordinates canonical.
 */
export const mirrorNormalizedY = (position: Position) =>
  clampNormalizedPosition({
    x: position.x,
    y: 1 - position.y,
  });

export const positionsRoughlyEqual = (
  a: Position,
  b: Position,
  epsilon = 1e-4
) => Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;

export const resolvePositionAgainstOccupied = ({
  targetPosition,
  occupied,
  maxAttempts,
  stepY = getCanonicalBattlefieldPlacementGridSteps().stepY,
}: {
  targetPosition: Position;
  occupied: Set<string>;
  maxAttempts: number;
  stepY?: number;
}) => {
  const clampedTarget = clampNormalizedPosition(targetPosition);
  let candidate = clampedTarget;
  let attempts = 0;

  while (
    occupied.has(normalizedPositionKey(candidate)) &&
    attempts < maxAttempts
  ) {
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
  stepY = getCanonicalBattlefieldPlacementGridSteps().stepY,
  maxAttempts = 200,
}: {
  movingCardId: string;
  targetPosition: Position;
  orderedCardIds: string[];
  getPosition: (cardId: string) => Position | null | undefined;
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
  stepY = getCanonicalBattlefieldPlacementGridSteps().stepY,
  maxAttempts = 200,
}: {
  movingCardIds: string[];
  targetPositions: Record<string, Position | undefined>;
  orderedCardIds: string[];
  getPosition: (cardId: string) => Position | null | undefined;
  getStepY?: (cardId: string) => number | undefined;
  stepY?: number;
  maxAttempts?: number;
}) => {
  if (movingCardIds.length === 0) return {} as Record<string, Position>;

  const movingSet = new Set(movingCardIds);
  const otherIds = orderedCardIds.filter((id) => !movingSet.has(id));
  const occupied = createOccupiedPositionSet(otherIds, getPosition);

  const resolved: Record<string, Position> = {};
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
    occupied.add(normalizedPositionKey(next));
  });

  return resolved;
};

export const bumpPosition = (
  position: Position,
  dx: number = GRID_STEP_X,
  dy: number = GRID_STEP_Y
) => clampNormalizedPosition({ x: position.x + dx, y: position.y + dy });

export const offsetNormalizedByGrid = (params: {
  position: Position;
  stepsX?: number;
  stepsY?: number;
} & CardOrientationOptions &
  ZoneDimensionOptions &
  CardDimensionOptions) => {
  const { stepX, stepY } = getCanonicalBattlefieldPlacementGridSteps({
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
  start: Position,
  zoneCardIds: string[],
  cards: Record<string, { position: Position }>,
  _stepX: number = GRID_STEP_X,
  stepY: number = getCanonicalBattlefieldPlacementGridSteps().stepY,
  maxChecks: number = 50
) => {
  const occupied = createOccupiedPositionSet(zoneCardIds, (id) => cards[id]?.position);

  let candidate = clampNormalizedPosition(start);
  let attempts = 0;
  while (
    occupied.has(normalizedPositionKey(candidate)) &&
    attempts < maxChecks
  ) {
    candidate = clampNormalizedPosition({ x: candidate.x, y: candidate.y + stepY });
    attempts += 1;
  }

  return candidate;
};
