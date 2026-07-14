import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SeatOrientationFrame } from "../SeatOrientationFrame";

describe("SeatOrientationFrame", () => {
  it.each([
    [false, false, "1", "1", "180deg"],
    [true, false, "1", "-1", "180deg"],
    [false, true, "-1", "1", "0deg"],
    [true, true, "-1", "-1", "0deg"],
  ])(
    "maps top=%s right=%s to one canonical layout transform",
    (isTop, isRight, mirrorX, mirrorY, verticalLabelRotation) => {
      const { container } = render(
        <SeatOrientationFrame isTop={isTop} isRight={isRight}>
          <div>Seat chrome</div>
        </SeatOrientationFrame>,
      );

      const frame = container.querySelector(
        "[data-seat-orientation-frame]",
      ) as HTMLElement;

      expect(frame.style.getPropertyValue("--seat-mirror-x")).toBe(mirrorX);
      expect(frame.style.getPropertyValue("--seat-mirror-y")).toBe(mirrorY);
      expect(
        frame.style.getPropertyValue("--seat-vertical-label-rotation"),
      ).toBe(verticalLabelRotation);
    },
  );
});
