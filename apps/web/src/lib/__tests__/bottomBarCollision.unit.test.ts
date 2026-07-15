import { describe, expect, it } from "vitest";
import type { Collision } from "@dnd-kit/core";

import { ZONE } from "@/constants/zones";
import { prioritizeBottomBarDropTargets } from "../bottomBarCollision";

const collision = (
  id: string,
  data: Record<string, unknown>,
): Collision =>
  ({
    id,
    data: {
      droppableContainer: { data: { current: data } },
      value: 0,
    },
  }) as Collision;

describe("bottom bar collision priority", () => {
  it("blocks the battlefield in space between bottom-bar zones", () => {
    const blocker = collision("bottom:p1", { dropSurface: "bottom-bar" });
    const battlefield = collision("battlefield:p1", {
      zoneId: "battlefield:p1",
      type: ZONE.BATTLEFIELD,
    });

    expect(
      prioritizeBottomBarDropTargets([battlefield, blocker]).map(({ id }) => id),
    ).toEqual(["bottom:p1"]);
  });

  it("keeps a real bottom-bar zone above the transparent blocker", () => {
    const blocker = collision("bottom:p1", { dropSurface: "bottom-bar" });
    const graveyard = collision("graveyard:p1", {
      zoneId: "graveyard:p1",
      type: ZONE.GRAVEYARD,
    });

    expect(
      prioritizeBottomBarDropTargets([graveyard, blocker]).map(({ id }) => id),
    ).toEqual(["graveyard:p1"]);
  });
});
