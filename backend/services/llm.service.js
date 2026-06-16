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
import ARC_CONTEXT from "../config/arcContext.js";
 import { getTagRule } from "../config/tagRules.js";

const localModelName = "qwen2.5:14b";


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
      options: { num_ctx: 4096, num_predict: 512 },
    };
    if (images.length) body.images = images;
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Ollama ${model} returned ${res.status}`);
    const data = await res.json();
    return (data.response || "").trim();
  } finally {
    clearTimeout(timer);
  }
}

async function ollamaChat({ model, messages }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        keep_alive: 0,
        options: { num_ctx: 4096, num_predict: 512 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Ollama chat ${model} returned ${res.status}`);
    const data = await res.json();
    return (data.message?.content || "").trim();
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
      prompt: `A the voice of a tabloid journalist describe this image
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

      Write 3-5 sentences.`,
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




// ── Call 1: Creative chapter generation ──────────────────────────────────

async function generateChapterText({ desc, tagRule, arcCtx, stateContext, lastChapter, chatHistory = [] }) {
 
  const chosenOperator = roll(OPERATOR_PERCENT) ? pickRandom(OPERATORS) : null;
  const moment = roll(MOMENT_PERCENT) ? pickRandom(INTERNET_MOMENTS) : null;
  console.log("[LLM] moment:", moment?.ref || "none", "| lastChapter:", lastChapter?.slice(0, 60));
  ///${moment ? `WEAVE THIS IN SUBTLY: ${moment.ref} — ${moment.hint}\n` : ""}

  
    // Build the user turn for this chapter
    const userContent =
          `NEW EVIDENCE FROM THE FIELD:
          ${desc}
          
          This image was tagged: ${tagRule}
          
          WHERE WE ARE IN THE SAGA TODAY:
          ${arcCtx}
          
          ${stateContext ? `SAGA STATE:\n${stateContext}\n` : ""}

          ${chosenOperator ? `use this operator once: ${chosenOperator}\n` : ""}
          ${moment ? `make a subtle reference to this internet phenomenon: ${moment.ref} — ${moment.hint}\n` : ""}

          Continue the saga. Write what happens next.
          HEADLINE: (max 8 words)
          CHAPTER: (3 sentences, each max 12 words)`;
  
    // Build messages array:
    // system prompt + all previous chapter turns + this new turn
    const messages = [
      { role: "system", content: VOICE_PROMPT },
      ...chatHistory,
      { role: "user", content: userContent },
    ];
  
    const raw = await ollamaChat({ model: localModelName, messages });
    console.log("[LLM] Raw chapter output:\n", raw);
  
    const parsed = parseChapter(raw);
  
    // Return the new history turn so caller can append it
    const newHistory = [
      { role: "user",      content: userContent },
      { role: "assistant", content: raw },
    ];
  
    return { ...parsed, newHistory };
}

// ── Call 2: State extraction ──────────────────────────────────────────────

async function extractStateUpdates({ headline, chapter, desc, tagRule, tagId }) {
const prompt = `You are a precise story-state tracker for the Saga of Omni-Alice.
Read the chapter below. Extract ONLY things that matter for the ongoing saga.
Be conservative. If unsure, skip it. Do not invent. Do not infer from images.

CHAPTER: "${headline ? headline + " — " : ""}${chapter}"

RULES:
- ALICE_TRAIT: only concrete character traits shown in THIS chapter
- ALICE_EXPERIENCE: one sentence — what just happened to Alice
- NPC_JOIN: only if a NEW named character appears and joins Alice. Format: Name | role | one trait
- CONSPIRACY_SEED: only if a specific detail hints at Slop Plot. One sentence, concrete.
- BELIEF_ADD: only if Alice explicitly believes something new. Her words or clear internal state.
- SUMMARY: 2 sentences max. What happened. What changed.
- THREAD_OPEN: only if THIS CHAPTER introduces a concrete unresolved story question
  involving a named person, place, or object Alice has actually interacted with.
  Format: [NAME] — one sentence describing the unresolved tension.
  Example: "The Backstage Map — Alice found a handdrawn map; where does it lead?"
  Example: "The Watcher — someone has been making eye contact across three fields"
  NOT: "The pink throne raised questions" — that is an image object, not a story thread
  NOT: "Mystery unfolds" — too vague to pay off

THREAD_RESOLVE: only if an existing open thread is concretely closed in this chapter.
  Use the exact thread name from when it was opened.

Do NOT extract:
- Challenges from image objects (pink thrones, crowns, chairs)
- NPCs from unnamed background people
- Threads from visual details in the image
- Anything not in the chapter text

STATE_UPDATES:
[only real values here]
END_UPDATES`;

  const raw = await ollamaGenerate({ model: localModelName, prompt });
  console.log("[LLM] Raw state output:\n", raw);
  return parseStateUpdates(raw);
}

// ── generateStoryOutput — two-call pipeline ───────────────────────────────

export async function generateStoryOutput({ config, analysis, state }) {
  const { descriptionLong, descriptionShort, tags, heroTag } = analysis;
  const desc    = descriptionShort || descriptionLong || tags?.join(", ") || "";
  const tagId   = heroTag?.id || "hero";
  const arcDay  = state?.grandArcDay || 1;
  const tagRule = getTagRule(tagId, arcDay);
  const arcCtx  = ARC_CONTEXT[arcDay] || ARC_CONTEXT[1];

  const { formatStateForPrompt } = await import("./story.state.service.js");
  const stateContext = state ? formatStateForPrompt(state) : "";

  console.log("[LLM] Call 1 — generating chapter. Tag:", tagId, "Arc day:", arcDay);

  // ── Call 1: Generate the creative chapter ─────────────────────────
  const { headline, chapter, newHistory } = await generateChapterText({
    desc,
    tagRule,
    arcCtx,
    stateContext,
    lastChapter: state?.lastChapter || null,
    chatHistory:  state?.chatHistory  || [],
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
  
  return { headline, chapter, stateUpdates: { ...stateUpdates, newHistory } };

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

const OPERATOR_PERCENT = 5; // % chance an operator is injected

const OPERATORS = [
  "Use one [noun]-maxxxing word naturally in the chapter. Example: grief-maxxxing, crowd-maxxxing, lore-maxxxing.",
  "Use one [noun]-core word naturally in the chapter. Example: mudcore, conspiracycore, barriercore.",
  "Use one [noun]-osphere word naturally in the chapter. Example: dude-osphere, punk-osphere, algo-osphere.",
];

// ── Internet moments ──────────────────────────────────────────────────────

const MOMENT_PERCENT = 2; // % chance an internet moment is injected

