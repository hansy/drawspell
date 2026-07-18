import { describe, expect, it } from "vitest";

import {
  getTouchDragActivationConstraint,
  getTouchDragActivationMode,
} from "../dndTouchSensors";

const buildActive = (touchDragActivation?: string) => ({
  data: {
    current: touchDragActivation ? { touchDragActivation } : {},
  },
});

describe("touch drag sensors", () => {
  it("uses movement rather than a hold for ordinary cards", () => {
    expect(getTouchDragActivationMode(buildActive() as any)).toBe("direct");
    expect(getTouchDragActivationConstraint("direct")).toEqual({ distance: 4 });
  });

  it("uses vertical displacement for hand cards", () => {
    expect(getTouchDragActivationMode(buildActive("vertical") as any)).toBe(
      "vertical",
    );
    expect(getTouchDragActivationConstraint("vertical")).toEqual({
      distance: { y: 6 },
    });
  });
});
