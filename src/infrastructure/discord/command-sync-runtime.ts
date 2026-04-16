import { DISCORD_COMMAND_DEFINITIONS } from "@/src/infrastructure/discord/commands";

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function resolveCommandsRoute(applicationId: string, guildId?: string): string {
  if (guildId) {
    return `/applications/${applicationId}/guilds/${guildId}/commands`;
  }
  return `/applications/${applicationId}/commands`;
}

async function syncDiscordCommands(): Promise<void> {
  const botToken = requireEnv("DISCORD_BOT_TOKEN");
  const applicationId = requireEnv("DISCORD_APPLICATION_ID");
  const guildId = process.env.DISCORD_COMMAND_GUILD_ID?.trim();
  const route = resolveCommandsRoute(applicationId, guildId);
  const response = await fetch(`${DISCORD_API_BASE_URL}${route}`, {
    method: "PUT",
    headers: {
      authorization: `Bot ${botToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(DISCORD_COMMAND_DEFINITIONS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Discord command sync failed: HTTP ${response.status} ${detail}`.trim());
  }

  const scope = guildId ? `guild ${guildId}` : "global";
  console.log(
    `[discord:commands] synced ${DISCORD_COMMAND_DEFINITIONS.length} commands to ${scope}`,
  );
}

syncDiscordCommands().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`[discord:commands] ${message}`);
  process.exitCode = 1;
});
