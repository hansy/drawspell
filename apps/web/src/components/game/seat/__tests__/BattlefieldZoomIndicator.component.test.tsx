import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BattlefieldZoomIndicator } from "../BattlefieldZoomIndicator";

const props = {
  limits: { min: 0.2, max: 2 },
  reversed: false,
  playerName: "Player",
  disabled: false,
  onChange: vi.fn(),
};
describe("temporary battlefield zoom indicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });
  afterEach(() => vi.useRealTimers());
  it("starts hidden, appears on zoom with no buttons, and disappears after inactivity", () => {
    const { rerender } = render(
      <BattlefieldZoomIndicator {...props} zoom={1} />,
    );
    expect(screen.queryByRole("slider")).toBeNull();
    rerender(<BattlefieldZoomIndicator {...props} zoom={1.05} />);
    expect(screen.getByRole("slider")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    act(() => vi.advanceTimersByTime(800));
    rerender(<BattlefieldZoomIndicator {...props} zoom={1.1} />);
    act(() => vi.advanceTimersByTime(800));
    expect(screen.getByRole("slider")).toBeTruthy();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole("slider")).toBeNull();
  });
  it("uses exact default and adjacent fixed levels for slider and keyboard", () => {
    const onChange = vi.fn();
    const { rerender } = render(<BattlefieldZoomIndicator {...props} onChange={onChange} zoom={0.9} />);
    rerender(<BattlefieldZoomIndicator {...props} onChange={onChange} zoom={0.95} />);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, {key: "ArrowUp"});
    expect(onChange).toHaveBeenLastCalledWith(1);
    fireEvent.change(slider, {target: {value: "0"}});
    expect(onChange).toHaveBeenLastCalledWith(1);
    fireEvent.change(slider, {target: {value: "0.037"}});
    expect(onChange).toHaveBeenLastCalledWith(1.05);
    fireEvent.change(slider, {target: {value: "-1"}});
    expect(onChange).toHaveBeenLastCalledWith(0.2);
  });
  it("stays visible during slider dragging and hides after release", () => {
    const { rerender } = render(
      <BattlefieldZoomIndicator {...props} zoom={1} />,
    );
    rerender(<BattlefieldZoomIndicator {...props} zoom={1.05} />);
    fireEvent.pointerDown(screen.getByRole("slider"));
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByRole("slider")).toBeTruthy();
    fireEvent.pointerUp(screen.getByRole("slider"));
    act(() => vi.advanceTimersByTime(900));
    expect(screen.queryByRole("slider")).toBeNull();
  });
});
