import React from "react";
import { cn } from "@/lib/utils";

interface BottomBarProps {
  isTop: boolean;
  isRight: boolean;
  children: React.ReactNode;
  className?: string;
  height?: number;
  onHeightChange?: (height: number) => void;
}

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 400;

export const BottomBar: React.FC<BottomBarProps> = ({
  isTop,
  isRight,
  children,
  className,
  height = 160,
  onHeightChange,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  React.useEffect(() => {
    if (!isDragging || !onHeightChange) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let newHeight: number;

      if (isTop) {
        // For top position, dragging down increases height
        newHeight = e.clientY - rect.top;
      } else {
        // For bottom position, dragging up increases height
        newHeight = rect.bottom - e.clientY;
      }

      // Clamp height between min and max
      newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newHeight));
      onHeightChange(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isTop, onHeightChange]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex w-full shrink-0 relative z-20",
        isRight ? "flex-row-reverse" : "flex-row",
        className
      )}
      style={{ height: `${height}px` }}
    >
      {/* Resize handle */}
      <div
        className={cn(
          "absolute left-0 right-0 z-30 group",
          isTop ? "bottom-0" : "top-0"
        )}
        onMouseDown={handleMouseDown}
      >
        {/* Hit area */}
        <div
          className={cn(
            "absolute left-0 right-0 cursor-ns-resize",
            isTop ? "bottom-0" : "top-0"
          )}
          style={{
            height: "8px",
            transform: isTop ? "translateY(50%)" : "translateY(-50%)",
          }}
        />

        {/* Visual indicator */}
        <div
          className={cn(
            "absolute left-0 right-0 h-[1px] transition-all",
            isTop
              ? "bottom-0 border-b border-white/5"
              : "top-0 border-t border-white/5",
            isDragging
              ? "bg-indigo-500 h-[2px]"
              : "bg-white/5 group-hover:bg-indigo-400/50 group-hover:h-[2px]"
          )}
        />
      </div>

      {children}
    </div>
  );
};
