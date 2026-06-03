/**
 * story.state.service.js
 * ----------------------
 * Manages the persistent StoryState — the living memory of the fairytale.
 * A single row (id = "singleton") holds all world-state between chapters.
 *
 * Exported:
 *   loadState()          → full StoryState object
 *   applyUpdates(state, updates) → merged state object
 *   saveState(state)     → writes back to DB
 *   formatStateForPrompt(state) → human-readable context string for LLM
 */

import { prisma } from "../lib/prisma.js";

// ── Default empty state ───────────────────────────────────────────────────

const DEFAULT_STATE = {
  id:                "singleton",
  aliceTraits:       [],
  aliceExperiences:  [],
  aliceAppearance:   null,
  villainTraits:     [],
  villainExperiences:[],
  villainAppearance: null,
  villainName:       null,
  npcs:              [],
  quests:            [],
  challenges:        [],
  beliefs:           [],
  threads:           [],
  grandArcDay:       1,
  chaptersWritten:   0,
  lastSummary:       null,
  lastChapter:       null,
};

// ── Load ──────────────────────────────────────────────────────────────────

export async function loadState() {
  const state = await prisma.storyState.upsert({
    where:  { id: "singleton" },
    update: {},
    create: DEFAULT_STATE,
  });
  return state;
}

// ── Save ──────────────────────────────────────────────────────────────────

export async function saveState(state) {
  return prisma.storyState.update({
    where: { id: "singleton" },
    data:  {
      aliceTraits:       state.aliceTraits,
      aliceExperiences:  state.aliceExperiences,
      aliceAppearance:   state.aliceAppearance,
      villainTraits:     state.villainTraits,
      villainExperiences:state.villainExperiences,
      villainAppearance: state.villainAppearance,
      villainName:       state.villainName,
      npcs:              state.npcs,
      quests:            state.quests,
      challenges:        state.challenges,
      beliefs:           state.beliefs,
      threads:           state.threads,
      grandArcDay:       state.grandArcDay,
      chaptersWritten:   state.chaptersWritten,
      lastSummary:       state.lastSummary,
      lastChapter:       state.lastChapter,
    },
  });
}

// ── Apply updates from LLM output ─────────────────────────────────────────

/**
 * Merges structured state updates returned by the LLM into the current state.
 * Updates is an object parsed from the STATE_UPDATES block.
 */
export function applyUpdates(state, updates) {
  const next = { ...state };
  next.chaptersWritten = (next.chaptersWritten || 0) + 1;

  // ── Alice ──────────────────────────────────────────────────────────────
  if (updates.aliceTraits?.length)
    next.aliceTraits = dedupe([...next.aliceTraits, ...updates.aliceTraits]);
  if (updates.aliceExperiences?.length)
    next.aliceExperiences = dedupe([...next.aliceExperiences, ...updates.aliceExperiences]);
  if (updates.aliceAppearance)
    next.aliceAppearance = updates.aliceAppearance;

  // ── Villain ────────────────────────────────────────────────────────────
  if (updates.villainTraits?.length)
    next.villainTraits = dedupe([...next.villainTraits, ...updates.villainTraits]);
  if (updates.villainExperiences?.length)
    next.villainExperiences = dedupe([...next.villainExperiences, ...updates.villainExperiences]);
  if (updates.villainAppearance)
    next.villainAppearance = updates.villainAppearance;
  if (updates.villainName)
    next.villainName = updates.villainName;

  // ── NPCs ───────────────────────────────────────────────────────────────
  const npcs = [...(next.npcs || [])];
  for (const npc of updates.npcJoin || []) {
    if (!npcs.find(n => n.name === npc.name))
      npcs.push({ id: uid(), ...npc, allegiance: "ally", active: true });
  }
  for (const flip of updates.npcFlip || []) {
    const n = npcs.find(n => n.name === flip.name);
    if (n) n.allegiance = flip.allegiance;
  }
  next.npcs = npcs;

  // ── Quests ─────────────────────────────────────────────────────────────
  const quests = [...(next.quests || [])];
  for (const q of updates.questOpen || [])
    quests.push({ id: uid(), description: q, status: "open", openedAt: now() });
  for (const q of updates.questClose || []) {
    const found = quests.find(x => x.description.includes(q) && x.status === "open");
    if (found) { found.status = "closed"; found.closedAt = now(); }
  }
  next.quests = quests;

  // ── Challenges ─────────────────────────────────────────────────────────
  const challenges = [...(next.challenges || [])];
  for (const c of updates.challengeOpen || [])
    challenges.push({ id: uid(), description: c, status: "open", openedAt: now() });
  for (const c of updates.challengeResolve || []) {
    const found = challenges.find(x => x.description.includes(c) && x.status === "open");
    if (found) found.status = "resolved";
  }
  next.challenges = challenges;

  // ── Beliefs ────────────────────────────────────────────────────────────
  const beliefs = [...(next.beliefs || [])];
  for (const b of updates.beliefAdd || [])
    beliefs.push({ statement: b, inverted: false });
  for (const b of updates.beliefInvert || []) {
    const found = beliefs.find(x => x.statement.includes(b));
    if (found) found.inverted = !found.inverted;
  }
  next.beliefs = beliefs;

  // ── Threads ────────────────────────────────────────────────────────────
  const threads = [...(next.threads || [])];
  for (const t of updates.threadOpen || [])
    threads.push({ id: uid(), description: t, status: "active" });
  for (const t of updates.threadResolve || []) {
    const found = threads.find(x => x.description.includes(t));
    if (found) found.status = "resolved";
  }
  next.threads = threads;

  // ── Rolling summary ────────────────────────────────────────────────────
  if (updates.summary)
    next.lastSummary = updates.summary;

  return next;
}

// ── Format state as LLM context ───────────────────────────────────────────

export function formatStateForPrompt(state) {
  const lines = [];

  // Grand arc position
  const arcNames = ["","Hero","Quest","Mentor","Challenge","Abyss","Villain","Transformation","Reward"];
  lines.push(`GRAND ARC: Day ${state.grandArcDay} — ${arcNames[state.grandArcDay] || "Unknown"} (chapter ${state.chaptersWritten + 1})`);

  // Last chapter — immediate narrative continuity
  if (state.lastChapter)
    lines.push(`\nLAST CHAPTER (do NOT repeat any of these lines — write what happens NEXT):\n"${state.lastChapter}"\nThe next chapter must move the story forward. New sentence. New moment. New image.`);

  // Rolling summary — long-term memory
  if (state.lastSummary)
    lines.push(`\nSTORY SO FAR (summary):\n${state.lastSummary}`);

  // Alice — compressed to prevent word-bank recycling
  if (state.aliceTraits?.length || state.aliceAppearance) {
    const traits = state.aliceTraits?.slice(-5).join(", ") || "unknown";
    const exp    = state.aliceExperiences?.slice(-3).join("; ") || "";
    lines.push(`\nOMNI-ALICE (context only — do not echo this language in the chapter):`);
    if (state.aliceAppearance) lines.push(`  Look: ${state.aliceAppearance}`);
    lines.push(`  Core traits: ${traits}`);
    if (exp) lines.push(`  Recent: ${exp}`);
  }

  // Villain — compressed
  if (state.villainTraits?.length || state.villainName) {
    const vtraits = state.villainTraits?.slice(-3).join(", ") || "unknown";
    lines.push(`\nTHE VILLAIN${state.villainName ? ` (${state.villainName})` : ""} (context only — do not echo this language):`);
    if (state.villainAppearance) lines.push(`  Look: ${state.villainAppearance}`);
    lines.push(`  Core traits: ${vtraits}`);
  }

  // Active NPCs
  const activeNpcs = (state.npcs || []).filter(n => n.active);
  if (activeNpcs.length) {
    lines.push(`\nACTIVE COMPANIONS:`);
    for (const n of activeNpcs)
      lines.push(`  • ${n.name} [${n.allegiance}]${n.traits ? ` — ${n.traits}` : ""}`);
  }

  // Open quests
  const openQuests = (state.quests || []).filter(q => q.status === "open");
  if (openQuests.length) {
    lines.push(`\nOPEN SIDEQUESTS:`);
    for (const q of openQuests) lines.push(`  • ${q.description}`);
  }

  // Open challenges
  const openChallenges = (state.challenges || []).filter(c => c.status === "open");
  if (openChallenges.length) {
    lines.push(`\nUNRESOLVED CHALLENGES:`);
    for (const c of openChallenges) lines.push(`  • ${c.description}`);
  }

  // Beliefs (highlight inverted ones)
  const beliefs = (state.beliefs || []);
  if (beliefs.length) {
    lines.push(`\nESTABLISHED TRUTHS:`);
    for (const b of beliefs)
      lines.push(`  ${b.inverted ? "⚠️ [INVERTED] " : ""}${b.statement}`);
  }

  // Active threads
  const activeThreads = (state.threads || []).filter(t => t.status === "active");
  if (activeThreads.length) {
    lines.push(`\nACTIVE STORYLINES:`);
    for (const t of activeThreads) lines.push(`  • ${t.description}`);
  }

  return lines.join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────

function dedupe(arr) { return [...new Set(arr)]; }
function uid()       { return Math.random().toString(36).slice(2, 10); }
function now()       { return new Date().toISOString(); }