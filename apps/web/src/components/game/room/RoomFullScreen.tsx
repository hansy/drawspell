import { LanguageSelector } from "@/components/LanguageSelector";
import { m } from "@/paraglide/messages.js";
import React from "react";

import { GameDialogActionButton } from "@/components/game/dialog/GameDialogActionButton";

type RoomFullScreenProps = {
  onLeave: () => void;
  onSpectate?: () => void;
  title?: string;
  description?: string;
  leaveLabel?: string;
};

export const RoomFullScreen: React.FC<RoomFullScreenProps> = ({
  onLeave,
  onSpectate,
  title = m.room_full_screen_room_is_full(),
  description = m.room_full_screen_this_room_already_has_the_maximum_number_of_players(),
  leaveLabel = m.room_full_screen_back_to_home(),
}) => {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="absolute right-4 top-4"><LanguageSelector /></div>
      <div className="max-w-xl w-full px-8 py-12 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg text-center">
        <h1 className="text-3xl font-semibold tracking-tight mb-3">{title}</h1>
        <p className="text-zinc-300 mb-8">{description}</p>
        <div className="flex flex-col gap-3">
          <GameDialogActionButton onClick={onLeave} className="w-full">
            {leaveLabel}
          </GameDialogActionButton>
          {onSpectate && (
            <GameDialogActionButton
              intent="secondary"
              onClick={onSpectate}
              className="w-full"
            >
              {m.room_full_screen_join_as_spectator()}</GameDialogActionButton>
          )}
        </div>
      </div>
    </div>
  );
};
