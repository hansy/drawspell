import { roundZoomUp, snapBattlefieldZoom } from "./battlefieldZoom";
import {
  BASE_CARD_HEIGHT,
  BATTLEFIELD_WORLD_WIDTH,
  BATTLEFIELD_WORLD_HEIGHT,
  MIN_BATTLEFIELD_VIEW_SCALE,
  MAX_BATTLEFIELD_VIEW_SCALE,
  CARD_ASPECT_RATIO,
  LEGACY_BATTLEFIELD_WIDTH,
  LEGACY_BATTLEFIELD_HEIGHT,
} from "@mtg/shared/constants/geometry";
import type { Position } from "@mtg/shared/positions";

export type BattlefieldCamera = {
  scale: number;
  offset: Position;
  reversed: boolean;
};
export const DEFAULT_VISIBLE_CARD_HEIGHTS = 3;
// The finite grid must cover the viewport, including at minimum zoom.
const worldWidth = BATTLEFIELD_WORLD_WIDTH;
const worldHeight = BATTLEFIELD_WORLD_HEIGHT;
const baseScaleFor = (height: number) =>
  Math.max(1, height) / (BASE_CARD_HEIGHT * DEFAULT_VISIBLE_CARD_HEIGHTS);
export const getBattlefieldZoomLimits = (width: number, height: number) => {
  const min = roundZoomUp(
    Math.max(
      MIN_BATTLEFIELD_VIEW_SCALE,
      Math.max(
        Math.max(1, width) / worldWidth,
        Math.max(1, height) / worldHeight,
      ) / baseScaleFor(height),
    ),
  );
  return { min, max: Math.max(MAX_BATTLEFIELD_VIEW_SCALE, min) };
};
export const clampBattlefieldZoom = (
  zoom: number,
  width: number,
  height: number,
) => {
  const limits = getBattlefieldZoomLimits(width, height);
  return snapBattlefieldZoom(zoom, limits.min, limits.max);
};
const startingOffset = (
  width: number,
  height: number,
  reversed: boolean,
): Position => {
  const inset = BASE_CARD_HEIGHT * 0.95 * baseScaleFor(height);
  return {
    x: reversed ? width - inset : inset,
    y: reversed ? height - inset : inset,
  };
};
// If the whole board fits on an axis, center it and disable panning on that axis.
const boundOffset = (offset: number, viewport: number, extent: number) =>
  extent <= viewport
    ? viewport / 2
    : Math.max(viewport - extent / 2, Math.min(extent / 2, offset));
export const createBattlefieldCamera = (
  width: number,
  height: number,
  zoom: number,
  reversed: boolean,
  pan: Position = { x: 0, y: 0 },
): BattlefieldCamera => {
  const scale =
    baseScaleFor(height) * clampBattlefieldZoom(zoom, width, height);
  const start = startingOffset(width, height, reversed);
  return {
    scale,
    reversed,
    offset: {
      x: boundOffset(start.x + pan.x * scale, width, worldWidth * scale),
      y: boundOffset(start.y + pan.y * scale, height, worldHeight * scale),
    },
  };
};
// Convert the rendered camera back to its bounded local state. This prevents
// invisible overscroll accumulating and causing a jump on the next gesture.
export const getBattlefieldCameraPan = (
  camera: BattlefieldCamera,
  width: number,
  height: number,
): Position => {
  const start = startingOffset(width, height, camera.reversed);
  return {
    x: (camera.offset.x - start.x) / camera.scale,
    y: (camera.offset.y - start.y) / camera.scale,
  };
};
export const getBattlefieldWorldRect = (camera: BattlefieldCamera) => ({
  left: camera.offset.x - (BATTLEFIELD_WORLD_WIDTH * camera.scale) / 2,
  top: camera.offset.y - (BATTLEFIELD_WORLD_HEIGHT * camera.scale) / 2,
  width: BATTLEFIELD_WORLD_WIDTH * camera.scale,
  height: BATTLEFIELD_WORLD_HEIGHT * camera.scale,
});
export const battlefieldToLocal = (
  position: Position,
  camera: BattlefieldCamera,
): Position => {
  const direction = camera.reversed ? -1 : 1;
  return {
    x:
      camera.offset.x +
      direction * position.x * LEGACY_BATTLEFIELD_WIDTH * camera.scale,
    y:
      camera.offset.y +
      direction * position.y * LEGACY_BATTLEFIELD_HEIGHT * camera.scale,
  };
};
export const localToBattlefield = (
  point: Position,
  camera: BattlefieldCamera,
): Position => {
  const direction = camera.reversed ? -1 : 1;
  return {
    x:
      (direction * (point.x - camera.offset.x)) /
      camera.scale /
      LEGACY_BATTLEFIELD_WIDTH,
    y:
      (direction * (point.y - camera.offset.y)) /
      camera.scale /
      LEGACY_BATTLEFIELD_HEIGHT,
  };
};
export const fitBattlefieldCards = (
  positions: Position[],
  width: number,
  height: number,
  reversed: boolean,
) => {
  if (!positions.length || !width || !height)
    return { zoom: 1, pan: { x: 0, y: 0 } };
  const xs = positions.map((p) => p.x * LEGACY_BATTLEFIELD_WIDTH);
  const ys = positions.map((p) => p.y * LEGACY_BATTLEFIELD_HEIGHT);
  // A full card height of padding accommodates tapped cards and annotations.
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const scale = Math.min(
    width / (maxX - minX + BASE_CARD_HEIGHT * 2),
    height / (maxY - minY + BASE_CARD_HEIGHT * 2),
  );
  const zoom = clampBattlefieldZoom(
    scale / baseScaleFor(height),
    width,
    height,
  );
  const camera = createBattlefieldCamera(width, height, zoom, reversed);
  const center = battlefieldToLocal(
    {
      x: (minX + maxX) / 2 / LEGACY_BATTLEFIELD_WIDTH,
      y: (minY + maxY) / 2 / LEGACY_BATTLEFIELD_HEIGHT,
    },
    camera,
  );
  const desired = {
    ...camera,
    offset: {
      x: camera.offset.x + width / 2 - center.x,
      y: camera.offset.y + height / 2 - center.y,
    },
  };
  const bounded = createBattlefieldCamera(
    width,
    height,
    zoom,
    reversed,
    getBattlefieldCameraPan(desired, width, height),
  );
  return { zoom, pan: getBattlefieldCameraPan(bounded, width, height) };
};
export const BATTLEFIELD_CARD_WIDTH = BASE_CARD_HEIGHT * CARD_ASPECT_RATIO;
