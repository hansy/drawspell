// Core dimensions
export const CARD_ASPECT_RATIO = 2 / 3; // 10/15 = 2/3 for clean math
export const BASE_CARD_HEIGHT = 120; // Base height in px

// Derived helper
export const getCardWidth = (height: number) => height * CARD_ASPECT_RATIO;

// Tailwind classes (derived from base)
export const CARD_HEIGHT_CLASS = 'h-[120px]';
export const CARD_ASPECT_CLASS = 'aspect-[2/3]';
export const ZONE_BASE_CLASSES = `${CARD_HEIGHT_CLASS} ${CARD_ASPECT_CLASS}`;
export const ZONE_SIDEWAYS_CLASSES = `w-[120px] aspect-[3/2]`;

// Layout baselines
export const BOARD_BASE_WIDTH = 1000;
export const BOARD_BASE_HEIGHT = 600;

// Zone viewer card sizing
export const ZONE_VIEWER_CARD_WIDTH = 180;
export const ZONE_VIEWER_CARD_HEIGHT = 252;
export const ZONE_VIEWER_STACK_OFFSET = 50;
export const ZONE_VIEWER_CARD_OVERLAP =
  ZONE_VIEWER_CARD_HEIGHT - ZONE_VIEWER_STACK_OFFSET;
