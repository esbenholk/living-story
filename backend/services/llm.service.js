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
    return { caption: "", memeText: "" };
  }

  try {
    const raw = await ollamaGenerate({
      model: "llava:latest",
      prompt: `Look at this image. You must respond with EXACTLY two lines, no more, no less:

    CAPTION: [one factual sentence describing what is on the image, max 88 chars, Do not use any lead-ins like "This is" or "In this image", simple state was is there: fx "a bowl of apples"]
    MEME: [one funny internet-style caption, max 60 chars]

    Example response:
    CAPTION: Two people dancing in a muddy field at sunset.
    MEME: when you find your people`,
      images: [imageB64],
    });

    console.log(`[LLM] Raw short output:\n`, raw);

    const captionMatch = raw.match(/CAPTION:\s*(.+)/i);
    const memeMatch = raw.match(/MEME:\s*(.+)/i);

    const caption = captionMatch ? captionMatch[1].trim() : raw.trim();
    const memeText = memeMatch ? memeMatch[1].trim() : "";

    console.log(`[LLM] Caption: ${caption.length} chars`, caption);
    console.log(`[LLM] Meme: ${memeText.length} chars`, memeText);

    return { caption, memeText };
  } catch (err) {
    console.warn("[LLM] Short description failed:", err.message);
    return { caption: "", memeText: "" };
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
      prompt: `For an image prompt to replicate this image, please describe it preciseley
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
    console.log(
      `[LLM] Long description: ${description.length} chars`,
      description,
    );
    return description;
  } catch (err) {
    console.warn("[LLM] Long description failed:", err.message);
    return "";
  }
}

// ── Tag behaviour definitions ─────────────────────────────────────────────

// ── Call 1: Creative chapter generation ──────────────────────────────────
async function generateChapterText({
  desc,
  tagRule,
  arcCtx,
  stateContext,
  lastChapter,
  openHook,
  chatHistory = [],
}) {
  if (!openHook) {
    const lastAssistant = [...chatHistory]
      .reverse()
      .find((m) => m.role === "assistant")?.content;
    const source = lastChapter || lastAssistant;
    if (source) openHook = extractHook(parseChapter(source).chapter);
  }

  const chosenOperator = roll(OPERATOR_PERCENT) ? pickRandom(OPERATORS) : null;
  const moment = roll(MOMENT_PERCENT) ? pickRandom(INTERNET_MOMENTS) : null;
  console.log(
    "[LLM] moment:",
    moment?.ref || "none",
    "| openHook:",
    openHook?.slice(0, 60) || "none",
  );

  const userContent = `THE LAST CHAPTER ENDED ON THIS OPEN HOOK:
        "${openHook || "Alice has only just arrived. Nothing is open yet."}"

        This new photograph is WHAT ALICE SEES NEXT as she chases that hook.
        Read the image AS the continuation — the answer, a clue, a complication, or a twist on it.
        Connect to the hook FIRST. Only then turn the plot and plant the next one.

        PREVIOUSLY IN THE SAGA:
        ${lastChapter || "This is the first page of Alice's diary."}

        TODAY'S PHOTOGRAPH — what Alice is living right now:
        ${desc}

        THE ROLE OF THIS PHOTOGRAPH:
        ${tagRule}

        TODAY'S MOOD AND MANDATE:
        ${arcCtx}

        OPEN THREADS (resolve one if you can — do not pile on new ones):
        ${stateContext || "None yet."}${moment ? `\n\nWeave in a subtle nod to: ${moment.ref} — ${moment.hint}` : ""}${chosenOperator ? `\n\n${chosenOperator}` : ""}

        Write the next chapter. Resume the hook, anchor in the photograph, move the plot one step, plant a new hook.
        Write to OMNI-ALICE, meaning you should say "you" in all references to OMNI-ALICE. 
        HEADLINE then CHAPTER. Chapter max 5 sentences.`;

  const messages = [
    { role: "system", content: VOICE_PROMPT },
    ...chatHistory,
    { role: "user", content: userContent },
  ];

  const raw = await ollamaChat({ model: localModelName, messages });
  console.log("[LLM] Raw chapter output:\n", raw);

  const parsed = parseChapter(raw);
  const newHistory = [{ role: "assistant", content: raw }];

  return { ...parsed, newHistory };
}

// ── Call 2: State extraction ──────────────────────────────────────────────

async function extractStateUpdates({
  headline,
  chapter,
  desc,
  tagRule,
  tagId,
  openThreads = [],
}) {
  const prompt = `You are a precise story-state tracker for the Saga of Omni-Alice.
Read the chapter below. Extract ONLY things that matter for the ongoing saga.
Be conservative. If unsure, skip it. Do not invent. Do not infer from images.

CHAPTER: "${headline ? headline + " — " : ""}${chapter}"

OPEN THREADS RIGHT NOW:
${openThreads.length ? openThreads.map((t) => `- ${t}`).join("\n") : "none"}

RULES:
- ALICE_TRAIT: only concrete character traits shown in THIS chapter
- ALICE_EXPERIENCE: one sentence — what just happened to Alice
- NPC_JOIN: only if a NEW named character appears and joins Alice. Format: Name | role | one trait
- CONSPIRACY_SEED: only if a specific detail hints at Slop Plot. One sentence, concrete.
- BELIEF_ADD: only if Alice explicitly believes something new. Her words or clear internal state.
- SUMMARY: 2 sentences max. What happened. What changed.
- THREAD_OPEN: only if THIS CHAPTER plants a concrete unresolved question
  involving a named person, place, or object Alice actually interacted with.
  Format: [NAME] — one sentence describing the unresolved tension.
  Open AT MOST ONE new thread, and only if the chapter clearly plants one.
- THREAD_RESOLVE: if the chapter closes one of the OPEN THREADS listed above,
  emit it using that thread's EXACT name. Resolving beats opening.

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
  const desc = descriptionShort || descriptionLong || tags?.join(", ") || "";
  const tagId = heroTag?.id || "hero";
  const arcDay = state?.grandArcDay || 1;
  const tagRule = getTagRule(tagId, arcDay);
  const arcCtx = ARC_CONTEXT[arcDay] || ARC_CONTEXT[1];

  const { formatStateForPrompt } = await import("./story.state.service.js");
  const stateContext = state ? formatStateForPrompt(state) : "";

  console.log(
    "[LLM] Call 1 — chapter. Tag:",
    tagId,
    "Arc day:",
    arcDay,
    "| hook:",
    state?.openHook || "none",
  );

  const { headline, chapter, hook, newHistory } = await generateChapterText({
    desc,
    tagRule,
    arcCtx,
    stateContext,
    lastChapter: state?.lastChapter || null,
    openHook: state?.openHook || null,
    chatHistory: state?.chatHistory || [],
  });

  if (!chapter) throw new Error("Chapter generation returned empty");

  console.log("[LLM] Call 2 — extracting state updates");

  const stateUpdates = await extractStateUpdates({
    headline,
    chapter,
    desc,
    tagRule,
    tagId,
    openThreads: state?.openThreads || [], // ← point at wherever your live threads live
  });

  // Persist the new hook so the NEXT chapter is forced to resume it.
  return {
    headline,
    chapter,
    stateUpdates: { ...stateUpdates, newHistory, openHook: hook },
  };
}

// ── Output parsers ────────────────────────────────────────────────────────

function parseChapter(raw) {
  const headlineMatch = raw.match(/HEADLINE:\s*(.+)/i);
  const chapterMatch = raw.match(
    /CHAPTER:\s*([\s\S]+?)(?=STATE_UPDATES:|END_UPDATES|$)/i,
  );

  const headline = headlineMatch
    ? headlineMatch[1].trim().replace(/^["']|["']$/g, "")
    : null;

  const chapter = chapterMatch ? chapterMatch[1].trim() : raw.trim();
  const hook = extractHook(chapter);

  return { headline, chapter, hook };
}

function extractHook(chapter) {
  const sentences = chapter.match(/[^.!?]+[.!?]+/g) || [chapter];
  const lastQuestion = [...sentences]
    .reverse()
    .find((s) => s.trim().endsWith("?"));
  return (lastQuestion || sentences.at(-1) || chapter).trim();
}

function parseStateUpdates(raw) {
  // Find the STATE_UPDATES block if present, otherwise parse the whole response
  const block =
    raw.match(/STATE_UPDATES:\s*([\s\S]+?)(?=END_UPDATES|$)/i)?.[1] || raw;
  const updates = {};
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l && !l.startsWith("[") && !l.startsWith("//") && !l.startsWith("─"),
    );

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toUpperCase();
    const value = line.slice(colonIdx + 1).trim();
    if (!value || value.startsWith("[")) continue;

    switch (key) {
      case "ALICE_TRAIT":
        updates.aliceTraits = value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "ALICE_APPEARANCE":
        updates.aliceAppearance = value;
        break;
      case "ALICE_EXPERIENCE":
        updates.aliceExperiences = [value];
        break;
      case "VILLAIN_NAME":
        updates.villainName = value;
        break;
      case "VILLAIN_TRAIT":
        updates.villainTraits = value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "VILLAIN_APPEARANCE":
        updates.villainAppearance = value;
        break;
      case "NPC_JOIN": {
        const [name, role, traits] = value.split("|").map((s) => s.trim());
        updates.npcJoin = [...(updates.npcJoin || []), { name, role, traits }];
        break;
      }
      case "NPC_FLIP": {
        const [name, allegiance] = value.split("|").map((s) => s.trim());
        updates.npcFlip = [...(updates.npcFlip || []), { name, allegiance }];
        break;
      }
      case "QUEST_OPEN":
        updates.questOpen = [...(updates.questOpen || []), value];
        break;
      case "QUEST_CLOSE":
        updates.questClose = [...(updates.questClose || []), value];
        break;
      case "CHALLENGE_OPEN":
        updates.challengeOpen = [...(updates.challengeOpen || []), value];
        break;
      case "CHALLENGE_RESOLVE":
        updates.challengeResolve = [...(updates.challengeResolve || []), value];
        break;
      case "BELIEF_ADD":
        updates.beliefAdd = [...(updates.beliefAdd || []), value];
        break;
      case "CONSPIRACY_SEED":
        updates.conspiracySeed = [...(updates.conspiracySeed || []), value];
        break;
      case "BELIEF_INVERT":
        updates.beliefInvert = [...(updates.beliefInvert || []), value];
        break;
      case "THREAD_OPEN":
        updates.threadOpen = [...(updates.threadOpen || []), value];
        break;
      case "THREAD_RESOLVE":
        updates.threadResolve = [...(updates.threadResolve || []), value];
        break;
      case "SUMMARY":
        updates.summary = value;
        break;
    }
  }
  return updates;
}

// ── generateChapter — retry-compatible wrapper ────────────────────────────

export async function generateChapter({ config, analysis }) {
  const { loadState, saveState, applyUpdates } =
    await import("./story.state.service.js");
  const state = await loadState();
  const output = await generateStoryOutput({ config, analysis, state });

  if (output.stateUpdates && Object.keys(output.stateUpdates).length > 0) {
    const nextState = applyUpdates(state, output.stateUpdates);
    await saveState(nextState).catch((e) =>
      console.warn("[LLM] State save failed on retry:", e.message),
    );
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

const OPERATOR_PERCENT = 10; // % chance an operator is injected

const OPERATORS = [
  "Use one [noun]-maxxxing word naturally in the chapter. Example: grief-maxxxing, crowd-maxxxing, lore-maxxxing.",
  "Use one [noun]-core word naturally in the chapter. Example: mudcore, conspiracycore, barriercore.",
  "Use one [noun]-osphere word naturally in the chapter. Example: dude-osphere, punk-osphere, algo-osphere.",
];

// ── Internet moments ──────────────────────────────────────────────────────

const MOMENT_PERCENT = 2; // % chance an internet moment is injected
