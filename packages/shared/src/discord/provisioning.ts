export const DISCORD_ROOM_PROVISION_PATH = "/games";

export type DiscordRoomProvisionRequest = {
  interactionId: string;
  guildId: string;
  channelId: string;
  invokerDiscordUserId: string;
  participantDiscordUserIds: string[];
};

export type DiscordRoomProvisionResponse = {
  roomId: string;
  playerToken: string;
  playerInviteUrl: string;
  expiresAt: number;
  alreadyProvisioned: boolean;
};

export type DiscordRoomInternalProvisionPayload = DiscordRoomProvisionRequest & {
  inviteExpiresAt: number;
};

export type DiscordRoomInternalProvisionResponse = {
  roomId: string;
  playerToken: string;
  expiresAt: number;
  alreadyProvisioned: boolean;
};
