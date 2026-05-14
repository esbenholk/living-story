/**
 * telegram/index.js
 * -----------------
 * Boots all Living Story Telegram bots from environment variables.
 * Call initAllBots(app) from server.js.
 *
 * Required env vars:
 *   TELEGRAM_PUBLIC_BOT_TOKEN          — public bot
 *   TELEGRAM_GROUP_BOT_TOKEN           — group listener bot
 *   TELEGRAM_MASTER_BOT_TOKEN          — master/admin bot
 *   TELEGRAM_MASTER_CHAT_ID            — your Telegram chat ID (find via @userinfobot)
 *
 * Personal bots (one per hero tag):
 *   TELEGRAM_BOT_HERO                  — token for The Hero bot
 *   TELEGRAM_BOT_QUEST
 *   TELEGRAM_BOT_MENTOR
 *   TELEGRAM_BOT_CHALLENGE
 *   TELEGRAM_BOT_ABYSS
 *   TELEGRAM_BOT_VILLAIN
 *   TELEGRAM_BOT_TRANSFORMATION
 *   TELEGRAM_BOT_REWARD
 *
 * Optional (production webhook mode):
 *   TELEGRAM_WEBHOOK_URL               — e.g. https://living-story-production.up.railway.app
 *                                        leave unset for polling (local dev)
 */

import { createPublicBot } from "./publicBot.js";
import { createPersonalBot } from "./personalBot.js";
import { createGroupBot } from "./groupBot.js";
import { createMasterBot } from "./masterBot.js";

const HERO_TAGS_ENV = [
  { id: "hero", env: "TELEGRAM_BOT_HERO" },
  { id: "quest", env: "TELEGRAM_BOT_QUEST" },
  { id: "mentor", env: "TELEGRAM_BOT_MENTOR" },
  { id: "challenge", env: "TELEGRAM_BOT_CHALLENGE" },
  { id: "abyss", env: "TELEGRAM_BOT_ABYSS" },
  { id: "villain", env: "TELEGRAM_BOT_VILLAIN" },
  { id: "transformation", env: "TELEGRAM_BOT_TRANSFORMATION" },
  { id: "reward", env: "TELEGRAM_BOT_REWARD" },
];

function validToken(envVar) {
  const val = process.env[envVar];
  return val && val.trim().length > 10; // real tokens are ~46 chars
}

export function initAllBots(app) {
  const bots = [];

  // ── Public bot ────────────────────────────────────────────────────────
  if (validToken("TELEGRAM_PUBLIC_BOT_TOKEN"))
    bots.push(createPublicBot(process.env.TELEGRAM_PUBLIC_BOT_TOKEN.trim()));

  if (validToken("TELEGRAM_GROUP_BOT_TOKEN"))
    bots.push(createGroupBot(process.env.TELEGRAM_GROUP_BOT_TOKEN.trim()));

  if (validToken("TELEGRAM_MASTER_BOT_TOKEN"))
    bots.push(createMasterBot(process.env.TELEGRAM_MASTER_BOT_TOKEN.trim()));

  for (const { id, env } of HERO_TAGS_ENV) {
    if (validToken(env))
      bots.push(createPersonalBot(process.env[env].trim(), id));
  }

  if (bots.length === 0) {
    console.warn("[Telegram] No bot tokens found in env — all bots disabled.");
  } else {
    console.log(`[Telegram] ${bots.length} bot(s) running.`);
  }

  return bots;
}
