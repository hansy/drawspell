import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BattlefieldGridOverlay } from "../BattlefieldGridOverlay";

describe("BattlefieldGridOverlay", () => {
  it("renders a thin line grid instead of dot markers", () => {
    const { container } = render(
      <BattlefieldGridOverlay
        visible
        gridStepX={120}
        gridStepY={20}
        originOffsetX={0}
        originOffsetY={0}
      />
    );

    const grid = container.querySelector("[data-battlefield-grid-overlay]");
    expect(grid).not.toBeNull();
    const backgroundImage = (grid as HTMLElement).style.backgroundImage;

    expect(backgroundImage).toContain("linear-gradient");
    expect(backgroundImage).not.toContain("radial-gradient");
  });
});
