import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GameDialogActionIntent = "primary" | "secondary";

type GameDialogActionButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "variant"
> & {
  intent?: GameDialogActionIntent;
};

export const GameDialogActionButton = React.forwardRef<
  HTMLButtonElement,
  GameDialogActionButtonProps
>(({ className, intent = "primary", ...props }, ref) => {
  const isSecondary = intent === "secondary";

  return (
    <Button
      ref={ref}
      variant={isSecondary ? "outline" : "default"}
      className={cn(
        isSecondary
          ? "border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          : "bg-indigo-600 text-white hover:bg-indigo-500",
        className,
      )}
      {...props}
    />
  );
});

GameDialogActionButton.displayName = "GameDialogActionButton";
