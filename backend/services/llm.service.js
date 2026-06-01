/**
 * llm.service.js
 *
 * describeImageShort(imageUrl)     — 1 sentence, max ~88 chars, for timeline cards
 * describeImageLong(imageUrl)      — 3-5 evocative sentences, for chapter generation
 * generateStoryOutput(opts)        — Omni-Alice fairytale chapter + state updates
 */

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const TIMEOUT_MS = 120_000;

// ── Core Ollama helper ────────────────────────────────────────────────────

async function ollamaGenerate({ model, prompt, images = [] }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body = { model, prompt, stream: false };
    if (images.length) body.images = images;
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
    if (!res.ok) throw new Error(`Ollama ${model} returned ${res.status}`);
    const data = await res.json();
    return (data.response || "").trim();
  } finally {
    clearTimeout(timer);
  }
}

// ── Image fetch helper ────────────────────────────────────────────────────

async function fetchImageB64(imageUrl) {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer()).toString("base64");
}

// ── describeImageShort — for timeline cards ───────────────────────────────

export async function describeImageShort(imageUrl) {
  console.log("[LLM] LLaVA short description...");
  let imageB64;
  try {
    imageB64 = await fetchImageB64(imageUrl);
  } catch (err) {
    console.warn("[LLM] Image fetch failed:", err.message);
    return "";
  }

  try {
    const description = await ollamaGenerate({
      model: "llava",
      prompt: `Output only a single short factual scene caption, maximum 88 characters, 1 sentence.

Describe only the visible scene content:
- who or what is present
- what they are doing
- where they are

Rules:
- Do NOT mention the image, picture, photo, painting, artwork, style, medium, or format.
- Do NOT use lead-ins like "This is", "There is", "In this image", or "A picture of".
- Do NOT add explanations, hedging, or extra text.
- Be clinical, concise, and visual.
- Return caption text only.

Good output example:
2 people dancing in a field

Bad output examples:
This is an image of 2 people dancing in a field
A painting of 2 people dancing in a field
In this photo, 2 people are dancing in a field`,
      images: [imageB64],
    });
    console.log(`[LLM] Short description: ${description.length} chars`, description);
    return description;
  } catch (err) {
    console.warn("[LLM] Short description failed:", err.message);
    return "";
  }
}

// ── describeImageLong — for chapter generation ────────────────────────────

export async function describeImageLong(imageUrl) {
  console.log("[LLM] LLaVA long description...");
  let imageB64;
  try {
    imageB64 = await fetchImageB64(imageUrl);
  } catch (err) {
    console.warn("[LLM] Image fetch failed:", err.message);
    return "";
  }

  try {
    const description = await ollamaGenerate({
      model: "llava",
      prompt: `Describe this image for a magical realist story writer.
Focus on:
- Mood and atmosphere (not just what you see, but what it feels like)
- Body language and emotional state of any people
- Relationships and interactions between subjects
- Tension, energy, or stillness in the scene
- Light, colour, and texture as emotional cues
- Anything strange, unexpected, or quietly significant

Write 3-5 sentences. Be evocative, not clinical.`,
      images: [imageB64],
    });
    console.log(`[LLM] Long description: ${description.length} chars`, description);
    return description;
  } catch (err) {
    console.warn("[LLM] Long description failed:", err.message);
    return "";
  }
}

// ── Tag behaviour definitions ─────────────────────────────────────────────

const TAG_RULES = {
  hero: `This image shows OMNI-ALICE herself.
- Extract character traits, mood, appearance details from the image.
- Weave these into Alice's characterisation.
- Add STATE_UPDATES: ALICE_TRAIT and/or ALICE_APPEARANCE as appropriate.`,

  quest: `This image shows something OUT OF PLACE — a catalyst for a sidequest.
- Interpret the image as a mysterious lure, anomaly or invitation to adventure.
- Open a new sidequest thread based on what you see.
- Add STATE_UPDATES: QUEST_OPEN describing the new sidequest.
- If an existing sidequest is clearly resolved by this image, close it with QUEST_CLOSE.`,

  mentor: `This image shows an NPC — a sidekick, guide or stranger.
- Give this character a name and personality based on the image.
- Decide their role: do they join Alice's team, share wisdom, tell a joke, or issue a challenge?
- Add STATE_UPDATES: NPC_JOIN with their name, role and traits.`,

  challenge: `This image shows a PROBLEM or OBSTACLE Alice and her companions must face.
- If a previous challenge is visually resolved, close it.
- Add STATE_UPDATES: CHALLENGE_OPEN for new challenges, CHALLENGE_RESOLVE for resolved ones.`,

  abyss: `This image represents CHAOS and INVERSION.
- Something we believed to be true is now called into question.
- An NPC ally may reveal themselves as an enemy, or vice versa.
- Write with a sense of dread, confusion and lost certainty.
- Add STATE_UPDATES: BELIEF_INVERT and/or NPC_FLIP as appropriate.`,

  villain: `This image shows THE VILLAIN or their influence.
- Extract traits, appearance and motivation from the image.
- If the villain has no name yet, give them one.
- Add STATE_UPDATES: VILLAIN_TRAIT, VILLAIN_APPEARANCE, VILLAIN_NAME as appropriate.`,

  transformation: `This image shows CHANGE, MUTATION or EVOLUTION.
- Take something from the previous chapter and merge it with this image.
- Something is irreversibly different now.
- Write with a sense of metamorphosis and awe.`,

  reward: `This image shows a REWARD — a treat, a gift, a moment of rest.
- Interpret the image as something given to a character in the story.
- Who receives it? What did they earn it for?
- Write with warmth, relief and earned stillness.`,
};

// ── Grand arc context ─────────────────────────────────────────────────────

const ARC_CONTEXT = {
  1: "We are establishing who Omni-Alice is. Focus on identity, presence and the world she inhabits.",
  2: "The call to adventure has come. Something disrupts Alice's world and pulls her forward.",
  3: "Alice is gathering companions and wisdom. New relationships are forming.",
  4: "Alice faces real obstacles. The journey is harder than expected.",
  5: "The darkest moment. Alice's core beliefs are shattered. Nothing is certain.",
  6: "The final confrontation looms. The villain's power is at its peak.",
  7: "Something irreversible has happened. Alice is changed forever.",
  8: "The journey is complete. Alice returns, transformed, bearing her reward.",
};

// ── generateStoryOutput — main chapter generation ─────────────────────────

export async function generateStoryOutput({ config, analysis, state }) {
  const { descriptionLong, descriptionShort, tags, heroTag } = analysis;
  const desc    = descriptionLong || descriptionShort || tags?.join(", ") || "";
  const tagId   = heroTag?.id || "hero";
  const tagRule = TAG_RULES[tagId] || TAG_RULES.hero;
  const arcDay  = state?.grandArcDay || 1;
  const arcCtx  = ARC_CONTEXT[arcDay] || ARC_CONTEXT[1];

  const { formatStateForPrompt } = await import("./story.state.service.js");
  const stateContext = state ? formatStateForPrompt(state) : "";

  console.log("[LLM] Generating Omni-Alice chapter — tag:", tagId, "arc day:", arcDay);

  const prompt = `You are the writer of an ongoing fairytale about OMNI-ALICE.
Write in a lyrical, fairy-tale voice — vivid, strange, alive.

═══ WORLD STATE ═══
${stateContext || "The story has just begun."}

═══ THIS CHAPTER ═══
Grand arc position: ${arcCtx}
Image tag: ${heroTag?.label || "Hero"} — ${heroTag?.names || ""}
What the image shows: ${desc}

═══ TAG RULE ═══
${tagRule}

═══ DUAL CONSIDERATION ═══
The image is tagged "${heroTag?.label}" but the grand arc is at Day ${arcDay} (${config?.headline || ""}).
Your chapter must honour BOTH — the image tag role AND the grand arc emotional position.

═══ OUTPUT FORMAT ═══
Write your response in EXACTLY this format. No extra text outside the blocks.

HEADLINE: [4-8 words, vivid present-tense, no punctuation at end]

CHAPTER: [3-5 sentences. Lyrical fairytale prose. Weave the image, the tag rule, and the arc together.]

STATE_UPDATES:
ALICE_TRAIT: [comma-separated traits, only if revealed]
ALICE_APPEARANCE: [one sentence, only if Hero image]
ALICE_EXPERIENCE: [one thing Alice has now experienced]
VILLAIN_NAME: [name, only if Villain image and unnamed]
VILLAIN_TRAIT: [comma-separated traits, only if Villain image]
VILLAIN_APPEARANCE: [one sentence, only if Villain image]
NPC_JOIN: [name] | [role: joined/wisdom/joke/challenge] | [traits]
NPC_FLIP: [name] | [new allegiance: ally/enemy]
QUEST_OPEN: [one sentence describing the new sidequest]
QUEST_CLOSE: [partial description of quest being resolved]
CHALLENGE_OPEN: [one sentence describing the challenge]
CHALLENGE_RESOLVE: [partial description of challenge being resolved]
BELIEF_ADD: [a truth now established in the story world]
BELIEF_INVERT: [partial text of belief being inverted]
THREAD_OPEN: [one sentence describing a new storyline thread]
THREAD_RESOLVE: [partial description of thread being resolved]
SUMMARY: [2-3 sentences summarising the whole story so far]
END_UPDATES`;

  const raw = await ollamaGenerate({ model: "mistral", prompt });
  console.log("[LLM] Raw output:\n", raw);
  return parseOutput(raw);
}

// ── Output parser ─────────────────────────────────────────────────────────

function parseOutput(raw) {
  const headlineMatch = raw.match(/HEADLINE:\s*(.+)/i);
  const chapterMatch  = raw.match(/CHAPTER:\s*([\s\S]+?)(?=STATE_UPDATES:|END_UPDATES|$)/i);
  const updatesMatch  = raw.match(/STATE_UPDATES:\s*([\s\S]+?)(?=END_UPDATES|$)/i);

  const headline = headlineMatch
    ? headlineMatch[1].trim().replace(/^["']|["']$/g, "")
    : null;
  const chapter = chapterMatch ? chapterMatch[1].trim() : raw;
  const stateUpdates = updatesMatch ? parseStateUpdates(updatesMatch[1]) : {};

  return { headline, chapter, stateUpdates };
}

function parseStateUpdates(block) {
  const updates = {};
  const lines   = block.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("["));

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key   = line.slice(0, colonIdx).trim().toUpperCase();
    const value = line.slice(colonIdx + 1).trim();
    if (!value || value.startsWith("[")) continue;

    switch (key) {
      case "ALICE_TRAIT":
        updates.aliceTraits = value.split(",").map(s => s.trim()).filter(Boolean); break;
      case "ALICE_APPEARANCE":
        updates.aliceAppearance = value; break;
      case "ALICE_EXPERIENCE":
        updates.aliceExperiences = [value]; break;
      case "VILLAIN_NAME":
        updates.villainName = value; break;
      case "VILLAIN_TRAIT":
        updates.villainTraits = value.split(",").map(s => s.trim()).filter(Boolean); break;
      case "VILLAIN_APPEARANCE":
        updates.villainAppearance = value; break;
      case "NPC_JOIN": {
        const [name, role, traits] = value.split("|").map(s => s.trim());
        updates.npcJoin = [...(updates.npcJoin || []), { name, role, traits }]; break;
      }
      case "NPC_FLIP": {
        const [name, allegiance] = value.split("|").map(s => s.trim());
        updates.npcFlip = [...(updates.npcFlip || []), { name, allegiance }]; break;
      }
      case "QUEST_OPEN":
        updates.questOpen = [...(updates.questOpen || []), value]; break;
      case "QUEST_CLOSE":
        updates.questClose = [...(updates.questClose || []), value]; break;
      case "CHALLENGE_OPEN":
        updates.challengeOpen = [...(updates.challengeOpen || []), value]; break;
      case "CHALLENGE_RESOLVE":
        updates.challengeResolve = [...(updates.challengeResolve || []), value]; break;
      case "BELIEF_ADD":
        updates.beliefAdd = [...(updates.beliefAdd || []), value]; break;
      case "BELIEF_INVERT":
        updates.beliefInvert = [...(updates.beliefInvert || []), value]; break;
      case "THREAD_OPEN":
        updates.threadOpen = [...(updates.threadOpen || []), value]; break;
      case "THREAD_RESOLVE":
        updates.threadResolve = [...(updates.threadResolve || []), value]; break;
      case "SUMMARY":
        updates.summary = value; break;
    }
  }
  return updates;
}

// ── generateChapter — retry-compatible wrapper ────────────────────────────
// Used by the /chapter/:id/retry route. Loads current state and delegates
// to generateStoryOutput so retries use the full Omni-Alice system.

export async function generateChapter({ config, analysis }) {
  const { loadState, saveState, applyUpdates } = await import("./story.state.service.js");
  const state  = await loadState();
  const output = await generateStoryOutput({ config, analysis, state });

  // Apply state updates from the retry
  if (output.stateUpdates && Object.keys(output.stateUpdates).length > 0) {
    const nextState = applyUpdates(state, output.stateUpdates);
    await saveState(nextState).catch(e =>
      console.warn("[LLM] State save failed on retry:", e.message));
  }

  // Return just the chapter text for backwards compatibility with retry route
  return output.chapter;
}