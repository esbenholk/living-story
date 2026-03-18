/**
 * heroTags.js
 *
 * The 8 stages of the Hero's Journey used as upload tags.
 * Index 0-7 maps directly to story days 1-8.
 *
 * Each entry:
 *   id       — stable key sent to the backend
 *   day      — corresponding default story day (1-indexed)
 *   label    — short display name shown under the button
 *   names    — full set of names for this stage (used in the LLM prompt)
 *   prompt   — how this stage should influence the chapter voice/direction
 *   svg      — filename inside src/assets/tags/ (you supply the SVGs)
 */

export const HERO_TAGS = [
  {
    id: "hero",
    day: 1,
    label: "The Hero",
    names: "The Avatar / The Main Character / The Self / The Hero",
    prompt:
      "This chapter introduces or re-centres the protagonist. Focus on identity, presence, and the inner world of the self. Who are they? What do they carry? Write from a place of embodied selfhood.",
    svg: "tag-hero.svg",
  },
  {
    id: "quest",
    day: 2,
    label: "The Quest",
    names: "The Quest / The Disruption / The Call",
    prompt:
      "Something shifts. A threshold is crossed or beckons. Focus on the moment of rupture — the call that cannot be ignored, the world tilting on its axis. Write with restless forward energy.",
    svg: "tag-quest.svg",
  },
  {
    id: "mentor",
    day: 3,
    label: "The Mentor",
    names: "The NPC / The Mentor / The Sidekick",
    prompt:
      "Another presence enters — a guide, a companion, a stranger who knows more than they should. Focus on connection, exchange, and the gift of being witnessed. Write with warmth and subtle mystery.",
    svg: "tag-mentor.svg",
  },
  {
    id: "challenge",
    day: 4,
    label: "The Challenge",
    names: "The Challenge / The Obstacle",
    prompt:
      "The path resists. Something must be overcome, endured, or outmanoeuvred. Focus on friction, effort, and the texture of difficulty. Write with grit and physical urgency.",
    svg: "tag-challenge.svg",
  },
  {
    id: "abyss",
    day: 5,
    label: "The Abyss",
    names: "The Abyss / The Dark / The Unknown / The Loss of Faith",
    prompt:
      "The lowest point. The hero is stripped of certainty. Focus on doubt, darkness, and the silence before something changes. Write slowly, with weight. Let nothing be resolved.",
    svg: "tag-abyss.svg",
  },
  {
    id: "villain",
    day: 6,
    label: "The Villain",
    names: "The Villain (Era) / The Anti-Self / The Anti-Hero",
    prompt:
      "The shadow rises — within or without. This is the confrontation with the force that opposes growth. Focus on the seductive logic of the anti-self. Write with dangerous clarity.",
    svg: "tag-villain.svg",
  },
  {
    id: "transformation",
    day: 7,
    label: "The Transformation",
    names: "The Transformation",
    prompt:
      "Something irreversible happens. The old self cannot continue. Focus on metamorphosis — the precise moment when identity cracks open and something new breathes in. Write with awe.",
    svg: "tag-transformation.svg",
  },
  {
    id: "reward",
    day: 8,
    label: "The Reward",
    names: "The Reward",
    prompt:
      "The journey completes its arc. What has been earned, understood, or accepted? Focus on arrival, integration, and the bittersweet taste of having changed. Write with earned stillness.",
    svg: "tag-reward.svg",
  },
];

/** Return the default tag for a given story day (1-indexed). */
export function defaultTagForDay(day) {
  return HERO_TAGS[Math.min(Math.max(day - 1, 0), HERO_TAGS.length - 1)];
}
