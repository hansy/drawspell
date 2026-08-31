import { buildCardActions, buildGroupActions, buildZoneMoveActions, buildZoneViewActions } from './menu';

/**
 * Central action registry to keep card/zone action builders in one place for
 * context menus and viewers.
 */
export const actionRegistry = {
  buildCardActions,
  buildGroupActions,
  buildZoneMoveActions,
  buildZoneViewActions,
};

export type ActionRegistry = typeof actionRegistry;
