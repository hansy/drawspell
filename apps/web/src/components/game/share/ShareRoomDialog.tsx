import React from "react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { GameDialogActionButton } from "@/components/game/dialog/GameDialogActionButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  spectatorLink: string;
  resumeLink?: string;
  linksReady?: boolean;
  errorMessage?: string;
  players: Record<PlayerId, Player>;
};

type ShareLinkFieldProps = {
  label: string;
  value: string;
  onCopy: (label: string, value: string) => void;
};

const ShareLinkField: React.FC<ShareLinkFieldProps> = ({
  label,
  value,
  onCopy,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {label}
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={value}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          className="bg-zinc-950 border-zinc-800 text-zinc-100"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!value}
          onClick={() => onCopy(label, value)}
          className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
        >
          <Copy size={16} />
          Copy
        </Button>
      </div>
    </div>
  );
};

const formatPlayerName = (player: Player, index: number) => {
  const trimmed = player.name?.trim();
  if (trimmed) return trimmed;
  return `Player ${index + 1}`;
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
    ? playerLink || (typeof window !== "undefined" ? window.location.href : "")
    : "";
  const resolvedSpectatorLink = linksReady
    ? spectatorLink || resolvedPlayerLink
    : "";

  const handleCopy = React.useCallback(async (label: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied to clipboard`);
    } catch (err) {
      console.error("Failed to copy link", err);
      toast.error("Failed to copy link");
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="ds-dialog-size-lg bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Share room</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Share the link below with players or spectators.
          </DialogDescription>
        </DialogHeader>

        <div className="ds-dialog-scroll space-y-4">
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                Players ({sortedPlayers.length}/{MAX_PLAYERS})
              </p>
              <p className="text-xs text-zinc-500">
                Players currently in the room
              </p>
            </div>

            <ul className="mt-3 space-y-1">
              {sortedPlayers.length > 0 ? (
                sortedPlayers.map((player, index) => (
                  <li key={player.id} className="text-sm text-zinc-200">
                    {formatPlayerName(player, index)}
                  </li>
                ))
              ) : (
                <li className="text-sm text-zinc-500">No players yet</li>
              )}
            </ul>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                Invite links
              </p>
              <p className="text-xs text-zinc-500">
                Copy a player or spectator link to share this room.
              </p>
            </div>

            {linksReady ? (
              <>
                {errorMessage ? (
                  <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                    <p className="font-medium">
                      Invite links could not be refreshed.
                    </p>
                    <p className="text-amber-100/80">{errorMessage}</p>
                  </div>
                ) : null}
                <ShareLinkField
                  label="Player invite link"
                  value={resolvedPlayerLink}
                  onCopy={handleCopy}
                />
                <ShareLinkField
                  label="Spectator invite link"
                  value={resolvedSpectatorLink}
                  onCopy={handleCopy}
                />
                {resumeLink ? (
                  <div className="border-t border-zinc-800 pt-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                      Private link (only for you)
                    </p>
                    <ShareLinkField
                      label="New device link (resume this session on another device)"
                      value={resumeLink}
                      onCopy={handleCopy}
                    />
                  </div>
                ) : null}
              </>
            ) : errorMessage ? (
              <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                <p className="font-medium">Unable to load invite links.</p>
                <p className="text-red-100/80">{errorMessage}</p>
              </div>
            ) : (
              <div className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-6 text-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-400">
                  <Loader2 size={17} className="animate-spin" />
                </div>
                <div className="text-sm font-medium text-zinc-300">
                  Generating invite links
                </div>
                <div className="max-w-56 text-xs leading-snug text-zinc-500">
                  Player and spectator links will appear here.
                </div>
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <GameDialogActionButton
            intent="secondary"
            onClick={onClose}
          >
            Close
          </GameDialogActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
