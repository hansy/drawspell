import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BattlefieldGridOverlay } from "../BattlefieldGridOverlay";

const geometry = {
  gridStepX: 45,
  gridStepY: 50,
  gridOriginX: 0,
  gridOriginY: 25,
};

describe("BattlefieldGridOverlay", () => {
  it("shows lines around snap centers only during a drag", () => {
    const { container, rerender } = render(
      <BattlefieldGridOverlay visible={false} {...geometry} />
    );
    expect(container.querySelector("[data-battlefield-grid-overlay]")).toBeNull();

    rerender(<BattlefieldGridOverlay visible {...geometry} />);
    const grid = container.querySelector<HTMLElement>("[data-battlefield-grid-overlay]");
    expect(grid).not.toBeNull();
    expect(grid?.style.backgroundImage).toContain("linear-gradient");
    expect(grid?.style.backgroundSize).toBe("45px 50px");
    expect(grid?.style.backgroundPosition).toBe("0px 25px");
  });
});
