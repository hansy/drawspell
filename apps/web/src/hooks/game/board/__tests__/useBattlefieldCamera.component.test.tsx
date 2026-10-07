import { useBattlefieldCameraStore } from "@/store/battlefieldCameraStore";
import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBattlefieldCamera } from "../useBattlefieldCamera";
import { useGameStore } from "@/store/gameStore";
import { localToBattlefield } from "@/lib/battlefieldCamera";

const pointer = (type: string, options: MouseEventInit) => {
  const event = new MouseEvent(type, { bubbles: true, ...options });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: "mouse" },
  });
  return event;
};
function Harness() {
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  const c = useBattlefieldCamera({
    playerId: "opponent",
    width: 600,
    height: 360,
    reversed: true,
    node,
  });
  return (
    <div
      ref={setNode}
      data-testid="camera"
      data-camera={JSON.stringify(c.camera)}
      data-panning={c.isPanning}
      onPointerDown={c.onPointerDown}
      onPointerMove={c.onPointerMove}
      onPointerUp={c.onPointerUp}
      onPointerCancel={c.onPointerUp}
    >
      <button onClick={c.reset}>Default</button>
      <button onClick={() => c.setZoom(0.5)}>Zoom out</button>
      <div data-card-id="card">Card</div>
    </div>
  );
}
describe("local battlefield camera interaction", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    useGameStore.setState({ battlefieldViewScale: {}, players: {} });
    useBattlefieldCameraStore.getState().clear();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 600,
      height: 360,
      right: 600,
      bottom: 360,
      toJSON: () => ({}),
    });
  });
  it("adopts a newly shared anchor in an untouched rotated view and keeps card coordinates unchanged", () => {
    render(<Harness />);
    const surface = screen.getByTestId("camera");
    const initial = JSON.parse(surface.dataset.camera!);
    act(() => useGameStore.setState(s => ({players: {...s.players, opponent: {
      ...s.players.opponent, battlefieldCameraAnchor: {x: 0.4, y: -0.2},
    }}})));
    const camera = JSON.parse(surface.dataset.camera!);
    expect(camera.offset.x - initial.offset.x).toBeCloseTo(400);
    expect(camera.offset.y - initial.offset.y).toBeCloseTo(-120);
  });
  it("preserves a manually panned view when the anchor arrives, then follows again after reset", () => {
    render(<Harness />);
    const surface = screen.getByTestId("camera");
    act(() => surface.dispatchEvent(pointer("pointerdown", {button: 2, clientX: 200, clientY: 150})));
    act(() => surface.dispatchEvent(pointer("pointermove", {buttons: 2, clientX: 240, clientY: 180})));
    act(() => surface.dispatchEvent(pointer("pointerup", {button: 2})));
    const manual = JSON.parse(surface.dataset.camera!);
    act(() => useGameStore.setState(s => ({players: {...s.players, opponent: {
      ...s.players.opponent, battlefieldCameraAnchor: {x: 0.4, y: -0.2},
    }}})));
    expect(JSON.parse(surface.dataset.camera!)).toEqual(manual);
    act(() => useGameStore.setState(s => ({players: {...s.players, opponent: {
      ...s.players.opponent, battlefieldCameraAnchor: {x: 0.1, y: 0.1}, battlefieldCameraEpoch: 1,
    }}})));
    expect(JSON.parse(surface.dataset.camera!)).not.toEqual(manual);
  });
  it("preserves a zoomed view when the anchor arrives", () => {
    render(<Harness />);
    const surface = screen.getByTestId("camera");
    fireEvent.click(screen.getByText("Zoom out"));
    const manual = JSON.parse(surface.dataset.camera!);
    act(() => useGameStore.setState(s => ({players: {...s.players, opponent: {
      ...s.players.opponent, battlefieldCameraAnchor: {x: 0.4, y: -0.2},
    }}})));
    expect(JSON.parse(surface.dataset.camera!)).toEqual(manual);
  });
  it("right-drag pans an opponent battlefield; release ends panning and Default restores it", () => {
    render(<Harness />);
    const surface = screen.getByTestId("camera");
    const initial = JSON.parse(surface.dataset.camera!);
    act(() =>
      surface.dispatchEvent(
        pointer("pointerdown", { button: 2, clientX: 200, clientY: 150 }),
      ),
    );
    expect(surface.dataset.panning).toBe("true");
    act(() =>
      surface.dispatchEvent(
        pointer("pointermove", { buttons: 2, clientX: 260, clientY: 180 }),
      ),
    );
    const next = JSON.parse(surface.dataset.camera!);
    expect(next.offset.x - initial.offset.x).toBeCloseTo(60);
    expect(next.offset.y - initial.offset.y).toBeCloseTo(30);
    act(() => surface.dispatchEvent(pointer("pointerup", { button: 2 })));
    expect(surface.dataset.panning).toBe("false");
    fireEvent.click(screen.getByText("Default"));
    expect(JSON.parse(surface.dataset.camera!)).toEqual(initial);
  });
  it("keeps left selection and card right-click available", () => {
    render(<Harness />);
    const surface = screen.getByTestId("camera");
    act(() => surface.dispatchEvent(pointer("pointerdown", { button: 0 })));
    expect(surface.dataset.panning).toBe("false");
    act(() =>
      screen
        .getByText("Card")
        .dispatchEvent(pointer("pointerdown", { button: 2 })),
    );
    expect(surface.dataset.panning).toBe("false");
  });
  it("wheel zoom preserves the point under the cursor and changes only this camera", () => {
    useGameStore.setState({ battlefieldViewScale: { me: 1.5 } });
    render(<Harness />);
    const surface = screen.getByTestId("camera");
    const point = { x: 230, y: 170 };
    const before = localToBattlefield(
      point,
      JSON.parse(surface.dataset.camera!),
    );
    fireEvent.wheel(surface, {
      deltaY: -120,
      clientX: point.x,
      clientY: point.y,
    });
    const after = localToBattlefield(
      point,
      JSON.parse(surface.dataset.camera!),
    );
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(useGameStore.getState().battlefieldViewScale.me).toBe(1.5);
    expect(useGameStore.getState().battlefieldViewScale.opponent).toBeCloseTo(
      1.05,
    );
  });
  it("slider zoom preserves the viewport center", () => {
    render(<Harness />);
    const surface = screen.getByTestId("camera");
    const before = localToBattlefield(
      { x: 300, y: 180 },
      JSON.parse(surface.dataset.camera!),
    );
    fireEvent.click(screen.getByText("Zoom out"));
    const after = localToBattlefield(
      { x: 300, y: 180 },
      JSON.parse(surface.dataset.camera!),
    );
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
  it("accumulates small pinch movements into fixed levels and returns exactly to default", () => {
    render(<Harness />);
    const surface = screen.getByTestId("camera");
    const touch = (type: string, id: number, x: number) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        clientX: x,
        clientY: 150,
      });
      Object.defineProperties(event, {
        pointerId: { value: id },
        pointerType: { value: "touch" },
      });
      act(() => surface.dispatchEvent(event));
    };
    touch("pointerdown", 1, 100);
    touch("pointerdown", 2, 200);
    for (let x = 201; x <= 220; x++) {
      touch("pointermove", 2, x);
      const zoom = useGameStore.getState().battlefieldViewScale.opponent ?? 1;
      expect(zoom * 20).toBeCloseTo(Math.round(zoom * 20));
    }
    expect(useGameStore.getState().battlefieldViewScale.opponent).toBe(1.1);
    for (let x = 219; x >= 200; x--) touch("pointermove", 2, x);
    expect(useGameStore.getState().battlefieldViewScale.opponent).toBe(1);
    touch("pointerup", 1, 100);
    touch("pointerup", 2, 200);
  });
  it("two-finger navigation pans without changing zoom when finger separation is unchanged", () => {
    render(<Harness />);
    const surface = screen.getByTestId("camera");
    const initial = JSON.parse(surface.dataset.camera!);
    const touch = (type: string, id: number, x: number) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        clientX: x,
        clientY: 150,
      });
      Object.defineProperties(event, {
        pointerId: { value: id },
        pointerType: { value: "touch" },
      });
      act(() => surface.dispatchEvent(event));
    };
    touch("pointerdown", 1, 100);
    touch("pointerdown", 2, 200);
    touch("pointermove", 1, 120);
    touch("pointermove", 2, 220);
    const next = JSON.parse(surface.dataset.camera!);
    expect(next.scale).toBeCloseTo(initial.scale);
    expect(next.offset.x - initial.offset.x).toBeCloseTo(20);
    touch("pointerup", 1, 120);
    touch("pointerup", 2, 220);
    expect(surface.dataset.panning).toBe("false");
  });
});
