import React from "react";

export type SeatOrientation = {
  isTop: boolean;
  isRight: boolean;
};

type SeatOrientationStyle = React.CSSProperties & {
  "--seat-mirror-x": number;
  "--seat-mirror-y": number;
  "--seat-vertical-label-rotation": string;
};

export const getSeatOrientationStyle = ({
  isTop,
  isRight,
}: SeatOrientation): SeatOrientationStyle => ({
  "--seat-mirror-x": isRight ? -1 : 1,
  "--seat-mirror-y": isTop ? -1 : 1,
  "--seat-vertical-label-rotation": isRight ? "0deg" : "180deg",
});

export const SeatOrientationFrame: React.FC<
  React.PropsWithChildren<SeatOrientation>
> = ({ isTop, isRight, children }) => (
  <div
    data-seat-orientation-frame
    data-seat-mirror-x={isRight ? "true" : "false"}
    data-seat-mirror-y={isTop ? "true" : "false"}
    className="ds-seat-orientation-frame pointer-events-none absolute inset-0"
    style={getSeatOrientationStyle({ isTop, isRight })}
  >
    {children}
  </div>
);
