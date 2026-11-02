import { m } from "@/paraglide/messages.js";
import { ZoneType } from '@/types';
import { ZONE, isCommanderZoneType } from '@mtg/shared/constants/zones';

export { ZONE, isCommanderZoneType };

export const ZONE_LABEL: Record<ZoneType, string> = {
  get library() { return m.zones_library(); },
  get hand() { return m.opponent_hand_summary_hand_2(); },
  get battlefield() { return m.zones_battlefield(); },
  get graveyard() { return m.zones_graveyard(); },
  get exile() { return m.model_exile(); },
  get commander() { return m.commander_zone_view_commander(); },
  get sideboard() { return m.zones_sideboard(); },
};
