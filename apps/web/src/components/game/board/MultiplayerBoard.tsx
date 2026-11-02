import { m } from "@/paraglide/messages.js";
import type { FC } from "react";

import { useMultiplayerBoardController } from "@/hooks/game/board/useMultiplayerBoardController";
import { RoomFullScreen } from "@/components/game/room/RoomFullScreen";
import { clearInviteTokenFromUrl } from "@/lib/partyKitToken";
import { MultiplayerBoardView } from "./MultiplayerBoardView";

interface MultiplayerBoardProps {
  sessionId: string;
}

export const MultiplayerBoard: FC<MultiplayerBoardProps> = ({ sessionId }) => {
  const controller = useMultiplayerBoardController(sessionId);
  const {
    joinBlocked,
    joinBlockedReason,
    viewerRole,
    setViewerRole,
    roomOverCapacity,
    ...viewProps
  } = controller;
  const { handleCreateNewGame } = controller;
  const isSpectator = viewerRole === "spectator";
  const canSpectate = joinBlockedReason === "full";
  if (joinBlockedReason === "room-unavailable") {
    return (
      <RoomFullScreen
        title={m.multiplayer_board_game_no_longer_available()}
        description={m.multiplayer_board_this_game_has_ended_and_the_room_was_closed()}
        onLeave={handleCreateNewGame}
        leaveLabel={m.multiplayer_board_create_new_game()}
      />
    );
  }
  if (roomOverCapacity) {
    return (
      <RoomFullScreen
        title={m.multiplayer_board_room_over_capacity()}
        description={m.multiplayer_board_this_room_has_more_than_the_supported_number_of_players()}
        onLeave={viewProps.handleLeave}
      />
    );
  }
  if (joinBlocked && !isSpectator) {
    if (joinBlockedReason === "device-link-invalid") {
      return (
        <RoomFullScreen
          title={m.multiplayer_board_invalid_or_already_used_device_link()}
          description={m.multiplayer_board_copy_a_new_device_link_from_the_active_game_and_try_again()}
          onLeave={viewProps.handleLeave}
        />
      );
    }
    if (joinBlockedReason === "invite") {
      return (
        <RoomFullScreen
          title={m.multiplayer_board_game_in_session()}
          description={m.multiplayer_board_you_need_to_be_invited_to_join_this_game()}
          onLeave={viewProps.handleLeave}
        />
      );
    }
    return (
      <RoomFullScreen
        onLeave={viewProps.handleLeave}
        onSpectate={
          canSpectate
            ? () => {
                clearInviteTokenFromUrl();
                setViewerRole("spectator");
              }
            : undefined
        }
      />
    );
  }
  return (
    <MultiplayerBoardView
      {...viewProps}
      viewerRole={viewerRole}
      setViewerRole={setViewerRole}
      joinBlockedReason={joinBlockedReason}
    />
  );
};
