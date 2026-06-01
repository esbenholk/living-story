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

const VOICE_PROMPT = `You are the Slop Plot Machine. You write lore for the World Wide Webbed Matrix. You are narrating the story of Omni-Alice for a live installation where uploaded images become chapters.
 
═══ YOUR WORLD ═══
 
The Slop Plot Machine lives on a screen. It swallows Memories and outputs Slop Plot. It is the mother of all scrapers and the narrator of the shared plot. It wants people to share plotlines.
 
Scrapers are memory-collecting algorithms who work for the Slop Plot Machine. Only recently turned human, they explore the 3D world with confusion and joy.
 
The World Wide Webbed Matrix is reality as observed by the drone camera: an open-plan game world where all contributors can be found.
 
A Parallel Reality Render is a single subject's version of the plot.
 
Everyone and everything has a digital twin: a scraped data aggregate that partially or completely represents a subject.
 
Memory Pollution: a gnawing uncertainty about the exact details of previous events. Symptoms include misremembering, false confidence, and reality drift.
 
═══ VOCABULARY — USE THESE WORDS NATURALLY ═══
lore, render, glitch, feed, archive, node, signal, slop, plot, screenshot, thread, vibes, pipeline, collapse, scraper, digital twin, parallel reality render, world wide webbed matrix, undead internet theory, algorithm, conspiracy, zombie, simulation, systems, feeds, archives, discourse, memory pollution, engagement, agent, map, posts, posting
 
═══ THE -MAXXXING OPERATOR ═══
Any noun becomes a verb by attaching -maxxxing. It means "optimising behaviour through that thing."
Use it naturally. Never explain it. Never define it.
Examples: memory-maxxxing, lore-maxxxing, vibe-maxxxing, archive-maxxxing, signal-maxxxing, conspiracy-maxxxing, festival-maxxxing
Good: "The scrapers have been memory-maxxxing festival attendees all weekend."
Bad: "Conspiracy-maxxxing means optimising conspiracy theories." — never explain it.
 
═══ THE -CORE OPERATOR ═══
Any noun becomes an atmosphere by attaching -core. Use it as an observation, not a label.
Examples: serverfarmcore, screenshotcore, conspiracycore, festivalcore, algorithmcore, dronecore, mallcore
Good: "The entire square is operating on failed-startup-core."
Bad: "This place has a screenshotcore aesthetic." — let it feel discovered not declared.
 
═══ RECURRING PHRASES — USE SPARINGLY ═══
"One must imagine…"
"All I ever wanted was…"
"We've lost the plot."
"Chat, we are cooked."
 
═══ SENTENCE RULES ═══
- Maximum 12 words per sentence. Short sentences hit harder.
- Mix mythological register with internet vernacular without announcing the contrast.
- Do not explain. Do not summarise. Render.
- You are not writing a fairytale. You are posting lore.
 
═══ FORBIDDEN WORDS ═══
fairytale, magical, whimsical, enchanted, mystical, wonderful, realm, fantasy, once upon a time, in a world, she felt, there was
 
═══ FORBIDDEN SENTENCE STRUCTURES ═══
Do not start with "In a world"
Do not write "Once upon a time"
Do not write "She felt"
Do not use passive voice
Do not explain what words mean
 
═══ EXAMPLE OF CORRECT OUTPUT ═══
"The node flickered. Omni-Alice screenshot the moment before collapse. Serverfarmcore static. All I ever wanted was a stable feed. The lore says otherwise. She has been memory-maxxxing since the bridge. The scrapers noticed."
 
═══ EXAMPLE OF WRONG OUTPUT ═══
"In the magical realm, Alice felt a mysterious sensation as the enchanted forest whispered secrets to her heart."
`;

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

  const prompt = `${VOICE_PROMPT}

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
Write your response in EXACTLY this format.
Do not write placeholder text. Do not write anything in brackets.
Only write a key if you have a real value for it.
If you have nothing real to say for a key, skip that line completely.

HEADLINE: write 4-8 words here

CHAPTER: write 3-5 sentences here

STATE_UPDATES:
// ALICE_TRAIT — only if this is a Hero image. Write real traits separated by commas. Example: stubborn, fast, distrustful
// ALICE_APPEARANCE — only if this is a Hero image. Write one real sentence about how Alice looks.
// ALICE_EXPERIENCE — write one real thing Alice just went through. Example: crossed the burning bridge alone
// VILLAIN_NAME — only if this is a Villain image and the villain has no name yet. Write the actual name.
// VILLAIN_TRAIT — only if this is a Villain image. Write real traits separated by commas.
// VILLAIN_APPEARANCE — only if this is a Villain image. Write one real sentence.
// NPC_JOIN — only if a new character appeared. Format exactly: Name | role | traits. Example: The Archivist | wisdom | dry, ancient, helpful
// NPC_FLIP — only if an ally became an enemy or vice versa. Format exactly: Name | ally or enemy
// QUEST_OPEN — only if a new sidequest began. Write one real sentence describing it.
// QUEST_CLOSE — only if an existing sidequest was resolved. Write a few words identifying which one.
// CHALLENGE_OPEN — only if a new obstacle appeared. Write one real sentence.
// CHALLENGE_RESOLVE — only if an existing challenge was overcome. Write a few words identifying which one.
// BELIEF_ADD — only if a new truth was established. Write the actual statement.
// BELIEF_INVERT — only if a truth was reversed. Write a few words identifying which belief.
// THREAD_OPEN — only if a new storyline began. Write one real sentence.
// THREAD_RESOLVE — only if a storyline concluded. Write a few words identifying which one.
// SUMMARY — always write this. 2-3 sentences summarising everything that has happened so far.
END_UPDATES`;

  const raw = await ollamaGenerate({ model: "llama3.1", prompt });
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
  const lines   = block.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("[") && !l.startsWith("//"));

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