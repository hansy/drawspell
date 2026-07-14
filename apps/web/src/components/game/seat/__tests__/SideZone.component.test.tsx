import { act, fireEvent, render } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ZONE } from "@/constants/zones";
import { CardPreviewProvider } from "../../card/CardPreviewProvider";

import { SideZone } from "../SideZone";

const createPointerEvent = (
  type: string,
  options: PointerEventInit & { pointerType?: string; pointerId?: number }
) => {
  if (typeof PointerEvent !== "undefined") {
    return new PointerEvent(type, options);
  }
  const fallback = new MouseEvent(type, options);
  Object.defineProperty(fallback, "pointerType", {
    value: options.pointerType ?? "mouse",
  });
  Object.defineProperty(fallback, "pointerId", {
    value: options.pointerId ?? 1,
  });
  return fallback as unknown as PointerEvent;
};

const zone = {
  id: "library-me",
  ownerId: "me",
  type: ZONE.LIBRARY,
  cardIds: [],
};

describe("SideZone touch gestures", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a dotted outline and a single bottom label when the edge zone is empty", () => {
    const { container, getByText } = render(
      <SideZone
        variant="edge"
        zone={zone as any}
        label="Library"
        count={92}
        visibleHeight={150}
      />
    );

    const edgeZone = container.querySelector('[data-side-zone-variant="edge"]');
    const dropZone = container.querySelector('[data-zone-id="library-me"]');
    const label = getByText("Library - 92");
    const emptyContent = container.querySelector("[data-edge-zone-empty-content]");
    const emptyLabel = container.querySelector("[data-edge-zone-empty-label]");

    expect(edgeZone).not.toBeNull();
    expect(dropZone?.classList.contains("border-dotted")).toBe(true);
    expect((emptyContent as HTMLElement | null)?.style.height).toBe("150px");
    expect(emptyLabel?.classList.contains("top-1/4")).toBe(true);
    expect(emptyLabel?.textContent).toBe("Library");
    expect(emptyLabel?.classList.contains("ds-seat-upright")).toBe(true);
    expect(label.classList.contains("bottom-1")).toBe(true);
    expect(label.classList.contains("ds-edge-zone-label")).toBe(true);
    expect(label.classList.contains("invisible")).toBe(true);
    expect(label.classList.contains("group-hover/edge-zone:visible")).toBe(true);
    expect(label.classList.contains("ds-seat-upright")).toBe(true);
  });

  it("removes the dotted outline when the edge zone contains a card", () => {
    const { container } = render(
      <DndContext>
        <CardPreviewProvider>
          <SideZone
            variant="edge"
            zone={{ ...zone, cardIds: ["card-1"] } as any}
            card={{
              id: "card-1",
              name: "Forest",
              ownerId: "me",
              controllerId: "me",
              zoneId: zone.id,
              tapped: false,
              faceDown: false,
              position: { x: 0, y: 0 },
              rotation: 0,
              counters: [],
            } as any}
            label="Library"
            count={1}
            disableCardDrag
          />
        </CardPreviewProvider>
      </DndContext>
    );

    const dropZone = container.querySelector('[data-zone-id="library-me"]');
    expect(dropZone?.classList.contains("border-dotted")).toBe(false);
  });

  it("maps touch double tap to onDoubleClick", () => {
    const onClick = vi.fn();
    const onDoubleClick = vi.fn();
    const { container } = render(
      <SideZone
        zone={zone as any}
        label="Library"
        count={0}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      />
    );

    const target = container.firstElementChild;
    if (!target) throw new Error("Expected SideZone root element");

    act(() => {
      fireEvent(
        target,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 20,
          clientY: 20,
        })
      );
      fireEvent(
        target,
        createPointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 20,
          clientY: 20,
        })
      );
      vi.advanceTimersByTime(100);
      fireEvent(
        target,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 20,
          clientY: 20,
        })
      );
      fireEvent(
        target,
        createPointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 20,
          clientY: 20,
        })
      );
    });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("fires click when mouse events originate from a card target", () => {
    const onClick = vi.fn();
    const { getByTestId } = render(
      <SideZone
        zone={zone as any}
        label="Library"
        count={0}
        onClick={onClick}
        emptyContent={
          <button type="button" data-testid="card-target" data-card-id="card-1">
            Card
          </button>
        }
      />
    );

    fireEvent.click(getByTestId("card-target"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("maps touch double tap on a card target to onDoubleClick", () => {
    const onClick = vi.fn();
    const onDoubleClick = vi.fn();
    const { getByTestId } = render(
      <SideZone
        zone={zone as any}
        label="Library"
        count={0}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        emptyContent={
          <button type="button" data-testid="card-target" data-card-id="card-1">
            Card
          </button>
        }
      />
    );

    const target = getByTestId("card-target");

    act(() => {
      fireEvent(
        target,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 20,
          clientY: 20,
        })
      );
      fireEvent(
        target,
        createPointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 20,
          clientY: 20,
        })
      );
      vi.advanceTimersByTime(100);
      fireEvent(
        target,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 20,
          clientY: 20,
        })
      );
      fireEvent(
        target,
        createPointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 20,
          clientY: 20,
        })
      );
    });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("opens context menu on touch long press", () => {
    const onContextMenu = vi.fn();
    const { container } = render(
      <SideZone
        zone={zone as any}
        label="Library"
        count={0}
        onContextMenu={onContextMenu}
      />
    );

    const target = container.firstElementChild;
    if (!target) throw new Error("Expected SideZone root element");

    act(() => {
      fireEvent(
        target,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 10,
          clientY: 10,
        })
      );
      vi.advanceTimersByTime(500);
    });

    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });

  it("opens context menu on touch long press from a card target", () => {
    const onContextMenu = vi.fn();
    const { getByTestId } = render(
      <SideZone
        zone={zone as any}
        label="Library"
        count={0}
        onContextMenu={onContextMenu}
        emptyContent={
          <button type="button" data-testid="card-target" data-card-id="card-1">
            Card
          </button>
        }
      />
    );

    const target = getByTestId("card-target");

    act(() => {
      fireEvent(
        target,
        createPointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerType: "touch",
          pointerId: 1,
          clientX: 10,
          clientY: 10,
        })
      );
      vi.advanceTimersByTime(500);
    });

    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });
});
