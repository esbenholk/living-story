/**
 * Changes needed in backend/routes/upload.js
 * -------------------------------------------
 * 1. Add imports at the top:
 */

import {
  loadState,
  saveState,
  applyUpdates,
} from "../services/story.state.service.js";

/**
 * 2. Replace the chapter generation block (around step 4) with:
 */

// Load world state
const state = await loadState();

// Generate chapter with full world context
let chapterText  = null;
let headlineText = null;
let stateUpdates = {};
let llmFailed    = false;

try {
  const output = await generateStoryOutput({ config, analysis, state });
  chapterText  = output.chapter;
  headlineText = output.headline;
  stateUpdates = output.stateUpdates || {};

  console.log("[UPLOAD] State updates:", stateUpdates);
} catch (e) {
  console.warn("[UPLOAD] LLM generation unavailable:", e.message);
  llmFailed = true;
}

// Apply and save state updates
if (!llmFailed && Object.keys(stateUpdates).length > 0) {
  const nextState = applyUpdates(state, stateUpdates);
  await saveState(nextState).catch(e =>
    console.warn("[UPLOAD] State save failed:", e.message));
}

/**
 * 3. The rest of upload.js (DB save, broadcast, res.json) stays the same.
 *    The generateStoryOutput signature changed — remove the storySoFar param:
 *
 *    OLD: generateStoryOutput({ config, storySoFar, analysis })
 *    NEW: generateStoryOutput({ config, analysis, state })
 *
 *    Also remove the assembleStory() call — state.lastSummary replaces it.
 */
