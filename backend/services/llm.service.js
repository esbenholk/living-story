/**
 * llm.service.js
 *
 * describeImageShort(imageUrl)     — 1 sentence, max ~88 chars, for timeline cards
 * describeImageLong(imageUrl)      — 3-5 evocative sentences, for chapter generation
 * generateStoryOutput(opts)        — two-call pipeline:
 *                                    1. creative chapter generation
 *                                    2. state extraction from that chapter
 */

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const TIMEOUT_MS = 120_000;
import VOICE_PROMPT from "../config/llmVoicePrompt.js";
import INTERNET_MOMENTS from "../config/internetMoments.js";

// ── Core Ollama helper ────────────────────────────────────────────────────

async function ollamaGenerate({ model, prompt, images = [] }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body = {
      model,
      prompt,
      stream: false,
      keep_alive: 0,
      options: {
        num_ctx: 4096,
        num_predict: 512,
      },
    };
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
      model: "llava:latest",
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
      model: "llava:latest",
      prompt: `Describe the feeling of this image
      Focus on:
      - What is physically happening — actions, movement, interactions
      - Who is present and what they are doing
      - Energy and mood of the scene
      - Anything unexpected or out of place

      Rules:
      - Do NOT mention the image, picture, photo, painting, artwork, style, medium, or format.
      - Do NOT use lead-ins like "This is", "There is", "In this image", or "A picture of".
      - Do NOT add explanations, hedging, or extra text.
      - Be clinical, concise, and visual.
      - Return caption text only.

      Write 3-5 sentences. Lead with action, not appearance.`,
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
Extract character traits, mood, appearance details from the image.
Weave these into Alice's characterisation.`,

  quest: `This image shows something OUT OF PLACE — a catalyst for a sidequest.
Interpret the image as a mysterious lure, anomaly or invitation to adventure.
Open a new sidequest thread based on what you see.`,

  mentor: `This image shows an NPC — a sidekick, guide or stranger.
Give this character a name and personality based on the image.
Decide their role: do they join Alice's team, share wisdom, or issue a challenge?`,

  challenge: `This image shows a PROBLEM or OBSTACLE Alice and her companions must face.`,

  abyss: `This image represents CHAOS and INVERSION.
Something we believed to be true is now called into question.
Write with a sense of dread, confusion and lost certainty.`,

  villain: `This image shows THE VILLAIN or their influence.
Extract traits, appearance and motivation from the image.
If the villain has no name yet, give them one.`,

  transformation: `This image shows CHANGE, MUTATION or EVOLUTION.
Take something from the previous chapter and merge it with this image.
Something is irreversibly different now.`,

  reward: `This image shows a REWARD — a treat, a gift, a moment of rest.
Interpret the image as something given to a character in the story.
Write with warmth, relief and earned stillness.`,
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

// ── Call 1: Creative chapter generation ──────────────────────────────────

async function generateChapterText({ desc, tagRule, arcCtx, stateContext, lastChapter }) {

  const chosenOperator = roll(OPERATOR_PERCENT) ? pickRandom(OPERATORS) : null;
  const operatorInstruction = chosenOperator
    ? `OPERATOR_WORD: [declare your ${chosenOperator} word here before writing]\n`
    : "";

  const moment = roll(MOMENT_PERCENT) ? pickRandom(INTERNET_MOMENTS) : null;
  const momentInstruction = moment
    ? `\n═══ INTERNET MOMENT (weave this in) ═══\nReference: ${moment.ref}\nHint: ${moment.hint}\nDo not explain it. Do not name it directly. Just let it bleed in.\n`
    : "";

  // console.log("[LLM] operator:", chosenOperator, "| moment:", moment?.ref || "none", "| lastChapter:", lastChapter);
        //   ${momentInstruction}
      // ${operatorInstruction}

  const prompt = `${VOICE_PROMPT}
        ═══ WORLD STATE ═══
        ${stateContext || "The story has just begun."}

        ${momentInstruction}

        ═══ CONTINUE FROM HERE ═══
        ${lastChapter
          ? `The last thing that happened was: "${lastChapter}"
        This chapter starts ONE SECOND LATER. Something from that moment must carry forward.
        Do not restate it. Do not summarise it. Pick up the thread and pull.`
          : "This is the first chapter. Establish the scene."}

        ═══ THIS IMAGE ═══
        What the image shows: ${desc}
        What this image means for the story: ${tagRule}
        Where we are in the grand arc: ${arcCtx}

        ═══ OUTPUT RULES ═══
        No markdown. No asterisks. No bold. No bullet points. Plain text only. 
        Do not write BREAKING NEWS. Do not add headers. Do not add labels beyond HEADLINE and CHAPTER.
        A HEADLINE is max 8 words. A CHAPTER is max 3 sentences, each max 12 words.
        ${operatorInstruction}

        ═══ EXAMPLE — OUTPUT EXACTLY LIKE THIS ═══
        HEADLINE: OMNI-ALICE Seen Alone at the Barrier — WITNESSES SPEAK

        CHAPTER: She DROPS her drink and no one helps her. Sources confirm she has been barrier-maxxxing for forty minutes. Experts are baffled.

        ═══ NOW WRITE THE NEXT CHAPTER ═══
        HEADLINE:
        CHAPTER:`;


  const raw = await ollamaGenerate({ model: "llama3.1:latest", prompt });
  console.log("[LLM] Raw chapter output:\n", raw);


  return parseChapter(raw);
}

// ── Call 2: State extraction ──────────────────────────────────────────────

async function extractStateUpdates({ headline, chapter, desc, tagRule, tagId }) {
  const prompt = `You are a data extraction system. Read the chapter below and extract structured story updates.
Only extract what is genuinely present in the chapter. Skip anything you are not certain about.
Return only the keys that have real values. No placeholder text. No brackets.

CHAPTER:
"${headline ? headline + " — " : ""}${chapter}"

IMAGE DESCRIPTION:
${desc}

IMAGE TAG: ${tagId}

─── EXTRACTION RULES ───
ALICE_TRAIT: hero tag only — comma-separated personality traits visible in this chapter
ALICE_APPEARANCE: hero tag only — one sentence about how Alice looks
ALICE_EXPERIENCE: one concrete thing Alice just did or went through
VILLAIN_NAME: villain tag only, only if unnamed — the actual name
VILLAIN_TRAIT: villain tag only — comma-separated traits
VILLAIN_APPEARANCE: villain tag only — one sentence
NPC_JOIN: new character only — format exactly: Name | role | traits
NPC_FLIP: allegiance change only — format exactly: Name | ally or enemy
QUEST_OPEN: new sidequest only — one sentence
QUEST_CLOSE: resolved sidequest only — a few words identifying which
CHALLENGE_OPEN: new obstacle only — one sentence
CHALLENGE_RESOLVE: overcome challenge only — a few words identifying which
BELIEF_ADD: new truth established — the actual statement
BELIEF_INVERT: reversed truth — a few words identifying which belief
THREAD_OPEN: new storyline — one sentence
THREAD_RESOLVE: concluded storyline — a few words
SUMMARY: always write this — 2-3 sentences of everything that has happened in the story so far

STATE_UPDATES:
[write only keys with real values here]
END_UPDATES`;

  const raw = await ollamaGenerate({ model: "llama3.1:latest", prompt });
  console.log("[LLM] Raw state output:\n", raw);
  return parseStateUpdates(raw);
}

// ── generateStoryOutput — two-call pipeline ───────────────────────────────

export async function generateStoryOutput({ config, analysis, state }) {
  const { descriptionLong, descriptionShort, tags, heroTag } = analysis;
  const desc    = descriptionLong || descriptionShort || tags?.join(", ") || "";
  const tagId   = heroTag?.id || "hero";
  const tagRule = TAG_RULES[tagId] || TAG_RULES.hero;
  const arcDay  = state?.grandArcDay || 1;
  const arcCtx  = ARC_CONTEXT[arcDay] || ARC_CONTEXT[1];

  const { formatStateForPrompt } = await import("./story.state.service.js");
  const stateContext = state ? formatStateForPrompt(state) : "";

  console.log("[LLM] Call 1 — generating chapter. Tag:", tagId, "Arc day:", arcDay);

  // ── Call 1: Generate the creative chapter ─────────────────────────
  const { headline, chapter } = await generateChapterText({
    desc,
    tagRule,
    arcCtx,
    stateContext,
    lastChapter: state?.lastChapter || null,  // ← add this

  });

  if (!chapter) throw new Error("Chapter generation returned empty");

  console.log("[LLM] Call 2 — extracting state updates");

  // ── Call 2: Extract state updates from the chapter ────────────────
  const stateUpdates = await extractStateUpdates({
    headline,
    chapter,
    desc,
    tagRule,
    tagId,
  });

  return { headline, chapter, stateUpdates };
}

// ── Output parsers ────────────────────────────────────────────────────────

function parseChapter(raw) {
  const headlineMatch = raw.match(/HEADLINE:\s*(.+)/i);
  const chapterMatch  = raw.match(/CHAPTER:\s*([\s\S]+?)(?=STATE_UPDATES:|END_UPDATES|$)/i);

  const headline = headlineMatch
    ? headlineMatch[1].trim().replace(/^["']|["']$/g, "")
    : null;

  // Fall back to full raw if no CHAPTER: tag found
  const chapter = chapterMatch ? chapterMatch[1].trim() : raw.trim();

  return { headline, chapter };
}

function parseStateUpdates(raw) {
  // Find the STATE_UPDATES block if present, otherwise parse the whole response
  const block = raw.match(/STATE_UPDATES:\s*([\s\S]+?)(?=END_UPDATES|$)/i)?.[1] || raw;
  const updates = {};
  const lines   = block
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("[") && !l.startsWith("//") && !l.startsWith("─"));

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

export async function generateChapter({ config, analysis }) {
  const { loadState, saveState, applyUpdates } = await import("./story.state.service.js");
  const state  = await loadState();
  const output = await generateStoryOutput({ config, analysis, state });

  if (output.stateUpdates && Object.keys(output.stateUpdates).length > 0) {
    const nextState = applyUpdates(state, output.stateUpdates);
    await saveState(nextState).catch(e =>
      console.warn("[LLM] State save failed on retry:", e.message));
  }

  return output.chapter;
}




function roll(percent) {
  return Math.random() * 100 < percent;
}



function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Operators ─────────────────────────────────────────────────────────────

const OPERATOR_PERCENT = 100; // % chance an operator is injected

const OPERATORS = [
  "Use one [noun]-maxxxing word naturally in the chapter. Example: grief-maxxxing, crowd-maxxxing, lore-maxxxing.",
  "Use one [noun]-core word naturally in the chapter. Example: mudcore, conspiracycore, barriercore.",
  "Use one [noun]-osphere word naturally in the chapter. Example: dude-osphere, punk-osphere, algo-osphere.",
];

// ── Internet moments ──────────────────────────────────────────────────────

const MOMENT_PERCENT = 100; // % chance an internet moment is injected

