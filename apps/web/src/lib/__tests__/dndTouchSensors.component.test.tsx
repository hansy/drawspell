import {
  DndContext,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoutedTouchSensor } from "../dndTouchSensors";

const Draggable = ({ mode }: { mode?: "vertical" }) => {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: "card",
    data: mode ? { touchDragActivation: mode } : undefined,
  });
  return (
    <div ref={setNodeRef} data-testid="card" {...attributes} {...listeners} />
  );
};

const Harness = ({ mode }: { mode?: "vertical" }) => {
  const sensors = useSensors(useSensor(RoutedTouchSensor));
  return (
    <DndContext sensors={sensors}>
      <Draggable mode={mode} />
    </DndContext>
  );
};

const touch = (clientX: number, clientY: number) => ({ clientX, clientY });

describe("RoutedTouchSensor", () => {
  it("starts an ordinary card drag from short movement", () => {
    const { getByTestId } = render(<Harness />);
    const card = getByTestId("card");

    fireEvent.touchStart(card, { touches: [touch(20, 20)] });
    fireEvent.touchMove(card, { touches: [touch(25, 20)] });

    expect(card.getAttribute("aria-pressed")).toBe("true");
    fireEvent.touchEnd(card, { changedTouches: [touch(25, 20)] });
  });

  it("leaves horizontal hand movement available for scrolling", () => {
    const { getByTestId } = render(<Harness mode="vertical" />);
    const card = getByTestId("card");

    fireEvent.touchStart(card, { touches: [touch(20, 20)] });
    fireEvent.touchMove(card, { touches: [touch(45, 21)] });

    expect(card.getAttribute("aria-pressed")).not.toBe("true");
    fireEvent.touchEnd(card, { changedTouches: [touch(45, 21)] });
  });

  it("starts a hand drag from short vertical movement", () => {
    const { getByTestId } = render(<Harness mode="vertical" />);
    const card = getByTestId("card");

    fireEvent.touchStart(card, { touches: [touch(20, 20)] });
    fireEvent.touchMove(card, { touches: [touch(21, 27)] });

    expect(card.getAttribute("aria-pressed")).toBe("true");
    fireEvent.touchEnd(card, { changedTouches: [touch(21, 27)] });
  });
});
