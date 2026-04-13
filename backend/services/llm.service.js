/**
 * llm.service.js
 *
 * describeImageShort(imageUrl)  — 1 sentence, max ~88 chars, for timeline cards
 * describeImageLong(imageUrl)   — 3-5 evocative sentences, for chapter generation
 * generateChapter(opts)         — Mistral chapter generation
 */

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const TIMEOUT_MS = 120_000;

async function ollamaGenerate({ model, prompt, images = [] }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body = { model, prompt, stream: false };
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

// ---------------------------------------------------------------------------
// Shared image fetch helper
// ---------------------------------------------------------------------------

async function fetchImageB64(imageUrl) {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer()).toString("base64");
}

// ---------------------------------------------------------------------------
// describeImageShort — for timeline cards
// One clinical sentence, max ~88 characters. Factual, visual, no metaphor.
// ---------------------------------------------------------------------------

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
    console.log(
      `[LLM] Short description: ${description.length} chars`,
      description,
    );
    return description;
  } catch (err) {
    console.warn("[LLM] Short description failed:", err.message);
    return "";
  }
}

// ---------------------------------------------------------------------------
// describeImageLong — for chapter generation
// 3-5 evocative sentences. Mood, atmosphere, body language, strangeness.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// generateChapter — Mistral
// ---------------------------------------------------------------------------

export async function generateChapter({ config, storySoFar, analysis }) {
  const { tags = [], colours = [], descriptionLong = "", heroTag } = analysis;

  const tagList = tags.join(", ") || "none";
  const colourList = colours.map((c) => c[0] || c).join(", ") || "unknown";
  const descLine = descriptionLong
    ? `Visual description: ${descriptionLong}`
    : "No visual description available.";

  const heroBlock = heroTag
    ? `Hero's Journey stage chosen by the uploader: ${heroTag.names}
Stage directive: ${heroTag.prompt}`
    : `Hero's Journey stage: unknown (use the day's default tone)`;

  const prompt = `You are writing a chapter for an 8-day collaborative story installation called "Living Story". The story follows the arc of the Hero's Journey — each upload contributes a moment tagged to one of its eight stages.

Story so far:
${storySoFar || "(This is the very first chapter — the story begins here.)"}

---
Image analysis:
- Cloudinary tags: ${tagList}
- Dominant colours: ${colourList}
- ${descLine}

---
${heroBlock}

---
Day ${config.day} chapter brief:
- Headline: ${config.headline}
- Tone: ${config.tone}
- Prompt: ${config.prompt}

---
Write a single chapter paragraph (120-180 words) that:
1. Continues naturally from the story so far
2. Draws on the mood and detail of the image analysis
3. Embodies the Hero's Journey stage described above — let the stage directive shape the voice, energy, and direction of the writing
4. Ends with a sentence that opens toward what comes next

Write only the paragraph. No title, no heading, no commentary.`;

  return ollamaGenerate({ model: "mistral", prompt });
}



export async function generateStoryOutput({ config, storySoFar, analysis }) {
  const { descriptionLong, descriptionShort, tags, colours, heroTag } =
    analysis;
  const desc = descriptionLong || descriptionShort || tags?.join(", ") || "";

  const prompt = `You are the narrator of a live 8-day story installation.

Story so far:
${storySoFar || "This is the first chapter."}

Today's theme: ${config.prompt}
Hero archetype: ${heroTag?.label || "unknown"} — ${heroTag?.names || ""}
Image: ${desc}

Write a response in exactly this format with no extra text:

HEADLINE: [4-8 words, vivid present-tense caption, no punctuation at end]
CHAPTER: [2-4 evocative sentences continuing the story, weaving in the image and archetype]`;

  const res = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "mistral", prompt, stream: false }),
  });

  if (!res.ok) throw new Error(`Ollama failed: ${res.status}`);
  const data = await res.json();
  const raw = (data.response || "").trim();

  // Parse the two sections
  const headlineMatch = raw.match(/HEADLINE:\s*(.+)/i);
  const chapterMatch = raw.match(/CHAPTER:\s*([\s\S]+)/i);

  const headline = headlineMatch
    ? headlineMatch[1].trim().replace(/^["']|["']$/g, "")
    : null;
  const chapter = chapterMatch ? chapterMatch[1].trim() : raw;

  return { headline, chapter };
}
