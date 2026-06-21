import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Card } from "@/types";

import {
  CardDragOverlayView,
  computeDragOverlayCardStyle,
  computeDragOverlayFrameStyle,
} from "../CardDragOverlayView";

vi.mock("../../card/CardView", () => ({
  CardView: ({
    card,
    style,
    isDragging,
    faceDown,
    "data-dnd-drag-overlay-card-view-id": overlayCardViewId,
  }: any) => (
    <div
      data-testid="overlay-card-view"
      data-card-id={card.id}
      data-dnd-drag-overlay-card-view-id={overlayCardViewId}
      data-face-down={String(faceDown)}
      data-is-dragging={String(isDragging)}
      style={style}
    />
  ),
}));

const createCard = (overrides: Partial<Card> = {}): Card => ({
  id: "c1",
  name: "Card",
  ownerId: "p1",
  controllerId: "p1",
  zoneId: "p1-battlefield",
  tapped: false,
  faceDown: false,
  position: { x: 0.5, y: 0.5 },
  rotation: 0,
  counters: [],
  ...overrides,
});

describe("CardDragOverlayView", () => {
  it("renders a tapped overlay card in the same orientation as the real card", () => {
    render(
      <CardDragOverlayView
        card={createCard({ tapped: true })}
        faceDown={false}
        preferArtCrop={false}
        data-dnd-drag-overlay-card-view-id="c1"
      />
    );

    const overlayCard = screen.getByTestId("overlay-card-view");
    expect(overlayCard.dataset.isDragging).toBe("true");
    expect(overlayCard.style.opacity).toBe("1");
    expect(overlayCard.style.transform).toBe("rotate(90deg)");
  });

  it("centers tapped overlay content inside a landscape frame", () => {
    const tappedCard = createCard({ tapped: true });
    const frameStyle = computeDragOverlayFrameStyle(tappedCard);
    const cardStyle = computeDragOverlayCardStyle(tappedCard);

    expect(frameStyle).toEqual({
      position: "relative",
      width: "var(--card-h, 120px)",
      height: "var(--card-w, 80px)",
    });
    expect(cardStyle.position).toBe("absolute");
    expect(cardStyle.width).toBe("var(--card-w, 80px)");
    expect(cardStyle.height).toBe("var(--card-h, 120px)");
    expect(cardStyle.left).toBe(
      "calc((var(--card-h, 120px) - var(--card-w, 80px)) / 2)"
    );
    expect(cardStyle.top).toBe(
      "calc((var(--card-w, 80px) - var(--card-h, 120px)) / 2)"
    );
  });
});
