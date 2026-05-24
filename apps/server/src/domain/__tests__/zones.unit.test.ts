import { describe, expect, it } from "vitest";

import {
  LEGACY_COMMAND_ZONE,
  ZONE,
  isCommanderZoneType,
  isHiddenZoneType,
  isPublicZoneType,
} from "../constants";
import { findZoneByType } from "../zones";
import type { Zone } from "@mtg/shared/types/zones";

describe("zone constants", () => {
  it("defines expected zone identifiers", () => {
    expect(ZONE).toEqual({
      LIBRARY: "library",
      HAND: "hand",
      BATTLEFIELD: "battlefield",
      GRAVEYARD: "graveyard",
      EXILE: "exile",
      COMMANDER: "commander",
      SIDEBOARD: "sideboard",
    });
    expect(LEGACY_COMMAND_ZONE).toBe("command");
  });

  it("classifies hidden zones correctly", () => {
    expect(isHiddenZoneType(ZONE.LIBRARY)).toBe(true);
    expect(isHiddenZoneType(ZONE.HAND)).toBe(true);
    expect(isHiddenZoneType(ZONE.SIDEBOARD)).toBe(true);
    expect(isHiddenZoneType(ZONE.BATTLEFIELD)).toBe(false);
    expect(isHiddenZoneType(ZONE.GRAVEYARD)).toBe(false);
    expect(isHiddenZoneType(ZONE.EXILE)).toBe(false);
    expect(isHiddenZoneType(ZONE.COMMANDER)).toBe(false);
  });

  it("classifies public zones correctly", () => {
    expect(isPublicZoneType(ZONE.BATTLEFIELD)).toBe(true);
    expect(isPublicZoneType(ZONE.GRAVEYARD)).toBe(true);
    expect(isPublicZoneType(ZONE.EXILE)).toBe(true);
    expect(isPublicZoneType(ZONE.COMMANDER)).toBe(true);
    expect(isPublicZoneType(ZONE.LIBRARY)).toBe(false);
    expect(isPublicZoneType(ZONE.HAND)).toBe(false);
    expect(isPublicZoneType(ZONE.SIDEBOARD)).toBe(false);
  });

  it("detects commander zones (including legacy command)", () => {
    expect(isCommanderZoneType(ZONE.COMMANDER)).toBe(true);
    expect(isCommanderZoneType(LEGACY_COMMAND_ZONE)).toBe(true);
    expect(isCommanderZoneType(ZONE.HAND)).toBe(false);
  });

  it("finds zones by owner and type, including legacy command", () => {
    const zones: Record<string, Zone> = {
      library: { id: "library", type: ZONE.LIBRARY, ownerId: "p1", cardIds: [] },
      otherLibrary: { id: "otherLibrary", type: ZONE.LIBRARY, ownerId: "p2", cardIds: [] },
      command: {
        id: "command",
        type: LEGACY_COMMAND_ZONE,
        ownerId: "p1",
        cardIds: [],
      } as unknown as Zone,
    };

    expect(findZoneByType(zones, "p1", ZONE.LIBRARY)?.id).toBe("library");
    expect(findZoneByType(zones, "p2", ZONE.LIBRARY)?.id).toBe("otherLibrary");
    expect(findZoneByType(zones, "p1", ZONE.COMMANDER)?.id).toBe("command");
    expect(findZoneByType(zones, "p3", ZONE.LIBRARY)).toBeNull();
  });
});
