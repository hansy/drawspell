import type { CSSProperties } from "react";
import "./landing.css";

type OrbitRing = {
  sizeClass: string;
  duration: string;
  reverse?: boolean;
  color: string;
  glow: string;
  dotSize?: string;
  shadow?: string;
  ring?: string;
};

const orbitRings: OrbitRing[] = [
  {
    sizeClass:
      "h-[280px] w-[280px] sm:h-[360px] sm:w-[360px] lg:h-[760px] lg:w-[760px]",
    duration: "12s",
    color: "#0b0a0f",
    glow: "rgba(246, 241, 222, 0.9)",
    ring: "rgba(246, 241, 222, 0.6)",
  },
  {
    sizeClass:
      "h-[330px] w-[330px] sm:h-[420px] sm:w-[420px] lg:h-[860px] lg:w-[860px]",
    duration: "15s",
    reverse: true,
    color: "#0b0a0f",
    glow: "rgba(14, 104, 171, 0.95)",
    ring: "rgba(14, 104, 171, 0.7)",
  },
  {
    sizeClass:
      "h-[380px] w-[380px] sm:h-[490px] sm:w-[490px] lg:h-[960px] lg:w-[960px]",
    duration: "18s",
    color: "#0b0a0f",
    glow: "rgba(147, 51, 234, 0.5)",
    dotSize: "12px",
    ring: "rgba(147, 51, 234, 0.4)",
    shadow: "rgba(147, 51, 234, 0.2)",
  },
  {
    sizeClass:
      "h-[430px] w-[430px] sm:h-[560px] sm:w-[560px] lg:h-[1060px] lg:w-[1060px]",
    duration: "21s",
    reverse: true,
    color: "#0b0a0f",
    glow: "rgba(211, 32, 42, 0.95)",
    ring: "rgba(211, 32, 42, 0.7)",
  },
  {
    sizeClass:
      "h-[480px] w-[480px] sm:h-[630px] sm:w-[630px] lg:h-[1160px] lg:w-[1160px]",
    duration: "24s",
    color: "#0b0a0f",
    glow: "rgba(0, 115, 62, 0.95)",
    ring: "rgba(0, 115, 62, 0.7)",
  },
];

type OrbitAnimationProps = {
  className?: string;
};

export function OrbitAnimation({ className }: OrbitAnimationProps) {
  return (
    <div className={`landing-orbit-frame ${className ?? ""}`.trim()}>
      {orbitRings.map((ring) => (
        <div
          key={ring.duration}
          className={`landing-orbit-shell ${ring.sizeClass}`}
        >
          <div
            className="landing-orbit-spin"
            style={
              {
                "--orbit-duration": ring.duration,
                animationDirection: ring.reverse ? "reverse" : "normal",
              } as CSSProperties
            }
          >
            <span
              className="landing-orbit-dot"
              style={
                {
                  "--dot-color": ring.color,
                  "--dot-glow": ring.glow,
                  "--dot-ring": ring.ring ?? ring.glow,
                  "--dot-shadow": ring.shadow,
                  "--dot-size": ring.dotSize,
                } as CSSProperties
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}
