import React from "react";
import {
  autoUpdate,
  FloatingPortal,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type PortraitSeatSwitcherOption = {
  playerId: string;
  label: string;
  color: string;
};

type PortraitSeatSwitcherProps = {
  seats: PortraitSeatSwitcherOption[];
  activePlayerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSeat: (playerId: string) => void;
};

const seatColorClass = (color: string | undefined) => {
  if (color === "rose") return "bg-rose-400";
  if (color === "violet") return "bg-violet-400";
  if (color === "sky") return "bg-sky-400";
  if (color === "amber") return "bg-amber-400";
  return "bg-zinc-300";
};

export const PortraitSeatSwitcher: React.FC<PortraitSeatSwitcherProps> = ({
  seats,
  activePlayerId,
  open,
  onOpenChange,
  onSelectSeat,
}) => {
  const activeSeat = seats.find((seat) => seat.playerId === activePlayerId) ?? seats[0];
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange,
    placement: "top",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "menu" });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ]);

  if (!activeSeat || seats.length < 2) return null;

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        aria-label={`Viewing ${activeSeat.label}. Change seat`}
        aria-expanded={open}
        data-testid="portrait-seat-switcher-trigger"
        data-no-seat-swipe="true"
        className={cn(
          "flex h-full min-w-0 items-center justify-center gap-2 rounded-md px-2",
          "text-sm font-semibold text-zinc-100 transition-colors duration-150",
          "hover:bg-zinc-800/80 active:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80",
          open && "bg-zinc-800/80",
        )}
        {...getReferenceProps()}
      >
        <span
          aria-hidden="true"
          className={cn(
            "h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/35",
            seatColorClass(activeSeat.color),
          )}
        />
        <span className="min-w-0 truncate">{activeSeat.label}</span>
        <ChevronsUpDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      </button>

      <FloatingPortal>
        {open && (
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            data-testid="portrait-seat-switcher-menu"
            data-no-seat-swipe="true"
            className="z-[80] w-[min(15rem,calc(100vw-1rem))] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 p-1 shadow-[0_6px_8px_rgba(0,0,0,0.4)]"
            {...getFloatingProps()}
          >
            {seats.map((seat) => {
              const active = seat.playerId === activePlayerId;
              return (
                <button
                  key={seat.playerId}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  aria-label={active ? `Currently viewing ${seat.label}` : `Switch to ${seat.label}`}
                  onClick={() => {
                    if (!active) onSelectSeat(seat.playerId);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm",
                    "text-zinc-200 transition-colors duration-150 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-300/80",
                    active && "bg-zinc-900 text-white",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-3 w-3 shrink-0 rounded-full ring-1 ring-white/35",
                      seatColorClass(seat.color),
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{seat.label}</span>
                  {active && <Check aria-hidden="true" className="h-4 w-4 text-indigo-300" />}
                </button>
              );
            })}
          </div>
        )}
      </FloatingPortal>
    </>
  );
};
