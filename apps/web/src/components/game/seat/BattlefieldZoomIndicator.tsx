import * as React from "react";
import {
  snapBattlefieldZoom,
  stepBattlefieldZoom,
} from "@/lib/battlefieldZoom";
import { cn } from "@/lib/utils";

export function BattlefieldZoomIndicator({
  zoom,
  limits,
  reversed,
  playerName,
  disabled,
  onChange,
}: {
  zoom: number;
  limits: { min: number; max: number };
  reversed: boolean;
  playerName: string;
  disabled: boolean;
  onChange: (zoom: number) => void;
}) {
  const previousZoom = React.useRef(zoom);
  const [visible, setVisible] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  React.useEffect(() => {
    if (previousZoom.current !== zoom) {
      previousZoom.current = zoom;
      setVisible(true);
    }
    if (dragging) return;
    const timeout = window.setTimeout(() => setVisible(false), 900);
    return () => window.clearTimeout(timeout);
  }, [zoom, dragging]);

  if (!visible) return null;
  return (
    <div
      data-camera-controls
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-30 flex w-12 flex-col items-center gap-1 px-1 py-2 text-cyan-100",
        reversed ? "left-2" : "right-2",
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <span className="w-full whitespace-nowrap text-center text-[11px] leading-4 tabular-nums drop-shadow-sm">
        {Math.round(zoom * 100)}%
      </span>
      <div className="relative flex h-36 w-10 justify-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-2 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-cyan-100/20"
        >
          {[0, 25, 50, 75, 100].map((position) => (
            <span
              key={position}
              data-zoom-tick={position === 50 ? "default" : "step"}
              className={cn(
                "absolute left-0 w-full -translate-y-1/2 rounded-full",
                position === 50 ? "h-1 bg-cyan-100" : "h-0.5 bg-cyan-100/60",
              )}
              style={{ top: `${position}%` }}
            />
          ))}
        </div>
        <input
          aria-label={`Zoom ${playerName} battlefield`}
          type="range"
          min={-1}
          max={1}
          step="any"
          className="relative h-full w-6 cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-300 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-cyan-300"
          style={{ writingMode: "vertical-lr", direction: "rtl" }}
          value={
            zoom < 1
              ? (zoom - 1) / (1 - limits.min)
              : (zoom - 1) / (limits.max - 1)
          }
          onChange={(event) => {
            const value = Number(event.target.value);
            onChange(
              snapBattlefieldZoom(
                1 + value * (value < 0 ? 1 - limits.min : limits.max - 1),
                limits.min,
                limits.max,
              ),
            );
          }}
          onKeyDown={(event) => {
            const direction = ["ArrowUp", "ArrowRight"].includes(event.key)
              ? "in"
              : ["ArrowDown", "ArrowLeft"].includes(event.key)
                ? "out"
                : null;
            if (
              !direction &&
              !["Home", "End", "PageUp", "PageDown"].includes(event.key)
            )
              return;
            event.preventDefault();
            event.stopPropagation();
            onChange(
              snapBattlefieldZoom(
                event.key === "Home"
                  ? limits.min
                  : event.key === "End"
                    ? limits.max
                    : stepBattlefieldZoom(
                        zoom,
                        direction ?? (event.key === "PageUp" ? "in" : "out"),
                      ),
                limits.min,
                limits.max,
              ),
            );
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onLostPointerCapture={() => setDragging(false)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
