import { createFileRoute, redirect } from "@tanstack/react-router";

const DISCORD_INSTALL_URL =
  "https://discord.com/oauth2/authorize?client_id=1479160336572616944";

export const Route = createFileRoute("/discord/install")({
  beforeLoad: () => {
    throw redirect({
      href: DISCORD_INSTALL_URL,
      replace: true,
    });
  },
  component: () => null,
});
