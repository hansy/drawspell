import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CardView } from "../CardView";

const card = {
  id: "c1",
  name: "Delver of Secrets",
  ownerId: "me",
  controllerId: "me",
  zoneId: "bf-me",
  tapped: false,
  faceDown: false,
  position: { x: 0.2, y: 0.2 },
  rotation: 0,
  counters: [],
} as any;

describe("CardView transform icon", () => {
  it("transforms the card without also tapping it", () => {
    const onTransform = vi.fn();
    const onClick = vi.fn();
    render(
      <CardView
        card={card}
        onClick={onClick}
        transformAction={{ label: "Transform: Insectile Aberration", onTransform }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Transform: Insectile Aberration" }));
    expect(onTransform).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows no icon for single-faced cards", () => {
    render(<CardView card={card} />);
    expect(document.querySelector("[data-card-transform]")).toBeNull();
  });
});
