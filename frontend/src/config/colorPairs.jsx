// ── Color palette — pairs that contrast well against each other ───────────
// Extracted from StoryAside so RecapAside can reuse the exact same palette.

export const COLOR_PAIRS = [
  { headline: "#ffe600", container: "#FF3400", text: "#3700ff" },
  { headline: "#FF3400", container: "#3700ff", text: "#ffe600" },
  { headline: "#00ff00", container: "#111111", text: "#FF3400" },
  { headline: "#FF3400", container: "#2f00ff", text: "#00ff00" },
  { headline: "#FF3400", container: "#111111", text: "#00ff00" },
  { headline: "#ffe600", container: "#FF3400", text: "#2f00ff" },
  { headline: "#000000", container: "#FF3400", text: "#ffffff" },
];

export function randomColorPair() {
  return COLOR_PAIRS[Math.floor(Math.random() * COLOR_PAIRS.length)];
}