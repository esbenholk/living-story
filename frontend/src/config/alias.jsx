// ── Session alias — shared by StoryAside and RecapAside ──────────────────
// Extracted so both Asides use the SAME random alias within a session,
// instead of each picking its own on module load.

const ALIAS_NAMES = ["SISSYFOS", "ATLAS", "QUERIA", "ANIMA", "TOM"];

export const SESSION_ALIAS = ALIAS_NAMES[Math.floor(Math.random() * ALIAS_NAMES.length)];
export const SESSION_FIRST_NAME = SESSION_ALIAS.split("-")[1] || SESSION_ALIAS;
export const SESSION_FIRST_NAME_CAPITALISED =
  SESSION_FIRST_NAME.charAt(0).toUpperCase() + SESSION_FIRST_NAME.slice(1).toLowerCase();

export function replaceAlice(text) {
  if (!text) return text;
  return text
    .replace(/OMNI-ALICE/g, SESSION_ALIAS)
    .replace(/Omni-Alice/g, SESSION_ALIAS)
    .replace(/omni-alice/g, SESSION_ALIAS.toLowerCase())
    .replace(/\bALICE\b/g, SESSION_FIRST_NAME)
    .replace(/\bAlice\b/g, SESSION_FIRST_NAME_CAPITALISED);
}

export function cleanText(text) {
  if (!text) return "…";
  return replaceAlice(
    text
      .split("\n")
      .filter((l) => !l.trim().startsWith("OPERATOR_WORD"))
      .join("\n")
      .trim()
  );
}