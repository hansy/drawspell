import { localizeRoomLink } from "@/i18n/navigation";
import { formatNumber } from "@/i18n/format";
import { m } from "@/paraglide/messages.js";
import React from "react";
import { Copy, Eye, KeyRound, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { GameDialogActionButton } from "@/components/game/dialog/GameDialogActionButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MAX_PLAYERS } from "@/lib/room";
import type { Player, PlayerId } from "@/types";

type ShareRoomDialogProps = {
  open: boolean;
  onClose: () => void;
  playerLink: string;
  spectatorLink?: string;
  resumeLink?: string;
  linksReady?: boolean;
  errorMessage?: string;
  players: Record<PlayerId, Player>;
};

type ShareLinkFieldProps = {
  label: string;
  copyLabel?: string;
  value: string;
  onCopy: (label: string, value: string) => void;
  icon: React.ReactNode;
  description?: string;
  privateLink?: boolean;
};

const ShareLinkField: React.FC<ShareLinkFieldProps> = ({
  label,
  copyLabel = label,
  value,
  onCopy,
  icon,
  description,
  privateLink,
}) => {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-x-2 text-zinc-300">
        <span className="mt-0.5 text-zinc-500">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
        {privateLink ? (
          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            {m.share_room_dialog_private()}</span>
        ) : null}
        {description ? (
          <p className="col-start-2 col-end-4 mt-1 text-xs leading-relaxed text-zinc-500">
            {description}
          </p>
        ) : null}
      </div>
      <div className="relative">
        <Input
          value={value}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          aria-label={label}
          className="w-full border-zinc-800 bg-zinc-950 pr-11 font-mono text-xs text-zinc-300 focus-visible:ring-inset"
        />
        <GameDialogActionButton
          type="button"
          intent="secondary"
          size="sm"
          aria-label={m.share_room_dialog_copy({ copyLabel: copyLabel })}
          className="absolute right-1 top-1 h-8 w-8 border-0 bg-transparent px-0 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
          disabled={!value}
          onClick={() => onCopy(copyLabel, value)}
        >
          <Copy size={16} />
        </GameDialogActionButton>
      </div>
    </div>
  );
};

const formatPlayerName = (player: Player, index: number) => {
  const trimmed = player.name?.trim();
  if (trimmed) return trimmed;
  return m.player_number({ number: formatNumber(index + 1) });
};

export const ShareRoomDialog: React.FC<ShareRoomDialogProps> = ({
  open,
  onClose,
  playerLink,
  spectatorLink,
  resumeLink = "",
  linksReady = true,
  errorMessage = "",
  players,
}) => {
  const sortedPlayers = React.useMemo(() => {
    return Object.values(players)
      .filter((player): player is Player => Boolean(player && player.id))
      .sort((a, b) => {
        const aKey = (a.name || a.id || "").toLowerCase();
        const bKey = (b.name || b.id || "").toLowerCase();
        return aKey.localeCompare(bKey);
      });
  }, [players]);

  const resolvedPlayerLink = linksReady
    ? localizeRoomLink(playerLink || (typeof window !== "undefined" ? window.location.href : ""))
    : "";
  const resolvedSpectatorLink = linksReady
    ? localizeRoomLink(spectatorLink || "")
    : "";

  const handleCopy = React.useCallback(async (label: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(m.share_room_dialog_copied_to_clipboard({ label: label }));
    } catch (err) {
      console.error("Failed to copy link", err);
      toast.error(m.share_room_dialog_failed_to_copy_link());
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="ds-dialog-size-xs bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>{m.share_room_dialog_share_room()}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {m.share_room_dialog_invite_someone_to_play_or_watch()}</DialogDescription>
        </DialogHeader>

        <div className="ds-dialog-scroll space-y-5">
          <section aria-label={m.share_room_dialog_players_in_room()}>
            <div className="flex items-center gap-2">
              <Users size={15} className="text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {m.portrait_seat_strip_players()}</p>
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                {sortedPlayers.length}/{MAX_PLAYERS}
              </span>
            </div>

            <ul className="mt-2.5 flex flex-wrap gap-2">
              {sortedPlayers.length > 0 ? (
                sortedPlayers.map((player, index) => (
                  <li
                    key={player.id}
                    className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300"
                  >
                    {formatPlayerName(player, index)}
                  </li>
                ))
              ) : (
                <li className="text-xs text-zinc-500">{m.share_room_dialog_no_players_yet()}</li>
              )}
            </ul>
          </section>

          <section className="space-y-4 border-t border-zinc-800 pt-4">
            {linksReady ? (
              <>
                {errorMessage ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                    {m.share_room_dialog_links_may_be_outdated()}{errorMessage}
                  </div>
                ) : null}
                <ShareLinkField
                  label={m.share_room_dialog_invite_player()}
                  copyLabel={m.share_room_dialog_player_invite_link()}
                  value={resolvedPlayerLink}
                  onCopy={handleCopy}
                  icon={<Users size={16} />}
                />
                {resolvedSpectatorLink ? <ShareLinkField
                  label={m.share_room_dialog_invite_spectator()}
                  copyLabel={m.share_room_dialog_spectator_invite_link()}
                  value={resolvedSpectatorLink}
                  onCopy={handleCopy}
                  icon={<Eye size={16} />}
                /> : null}
                {resumeLink ? (
                  <div className="border-t border-zinc-800 pt-4">
                    <ShareLinkField
                      label={m.share_room_dialog_switch_device()}
                      copyLabel={m.share_room_dialog_device_switch_link()}
                      value={localizeRoomLink(resumeLink)}
                      onCopy={handleCopy}
                      icon={<KeyRound size={16} />}
                      description={m.share_room_dialog_open_this_link_on_another_device_to_continue_as_this_player()}
                      privateLink
                    />
                  </div>
                ) : null}
              </>
            ) : errorMessage ? (
              <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                <p className="font-medium">{m.share_room_dialog_unable_to_load_invite_links()}</p>
                <p className="text-red-100/80">{errorMessage}</p>
              </div>
            ) : (
              <div className="flex min-h-24 items-center justify-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400">
                  <Loader2 size={17} className="motion-safe:animate-spin" />
                </div>
                <div className="text-sm font-medium text-zinc-300">{m.share_room_dialog_creating_links()}</div>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
