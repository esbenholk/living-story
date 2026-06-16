/**
 * tagRules.js
 *
 * TAG_RULES tell the model how to interpret each tagged image.
 * They work together with the arc context — the arc sets the emotional register,
 * the tag rule sets the narrative role of this specific image.
 *
 * The villain tag is day-aware:
 * early days → Adam is charming and fun, not yet an antagonist
 * later days → Adam is clearly blocking Alice, allegiance revealed
 */

export function getTagRule(tagId, arcDay) {
  if (tagId === "villain" || tagId === "ratava") {
    return getVillainRule(arcDay);
  }
  return TAG_RULES[tagId] || TAG_RULES.hero;
}

function getVillainRule(arcDay) {
  if (arcDay <= 3) {
    return `This image is associated with ADAM — a charming, hedonistic stranger Alice keeps running into.
He is fun. He is magnetic. He loves the festival and wants Alice to have fun too.
Use this image to show who Adam is: his energy, his vibe, what he's doing right now.`;
  }

  if (arcDay === 4 || arcDay === 5) {
    return `This image is associated with ADAM — a charming hedonist who keeps appearing around Alice.
Today he is in the way. He redirects. He distracts. He makes the quest feel unnecessary.
Why investigate the festival when you could just dance? Adam makes that argument feel very good.
Use this image to show Adam steering Alice away from something — smoothly, pleasurably, infuriatingly.`;
  }

  // arcDay 6+
  return `This image is associated with ADAM — Slop Plot's human-facing agent.
He has always known what Alice is. He has been managing her from the beginning.
He is still charming. He is now clearly in her way.
Use this image to show Adam blocking Alice — or Alice finally confronting him.`;
}

export const TAG_RULES = {
  hero: `This image shows OMNI-ALICE or her immediate experience. If there is a face, it is the face of OMNi-ALICE regardless of the gender, race and species of the creature in the image, consider this an image of OMNI-ALICE. 
Use it to reveal something about who she is — her reactions, her instincts, her way of seeing.
Let her personality emerge through how she encounters whatever is in this image.`,

  quest: `This image shows something that pulls Alice toward adventure — an anomaly, an invitation, a mystery.
Interpret it as a lure or a catalyst. Something here doesn't add up, and Alice wants to know why.
Open or advance a thread. Let Alice follow it even when she shouldn't.`,

  mentor: `This image shows a companion, guide or stranger who joins Alice's fellowship.
Give this character a name and a specific trait. Make them memorable and distinct.
Decide what they bring to the group — wisdom, chaos, a skill, a secret.`,

  challenge: `This image shows an obstacle, a cost, or a blocked path.
Something Alice needs is harder to reach because of what's in this image.
Let the obstacle have weight. Let it slow the fellowship down or force a choice.`,

  abyss: `This image represents loss, inversion, or the moment something believed turns false.
Something the fellowship trusted is called into question.
Write with vertigo. The ground has shifted. Nothing is quite what it was.`,

  villain: `See getTagRule() — villain rule is day-aware and handled separately above.`,

  transformation: `This image shows change — in Alice, in the fellowship, in how the world is understood.
Something is irreversibly different now. Use the image to mark the before and after.
Reference something from earlier in the saga that now means something completely different.`,

  reward: `This image shows a gift, a rest, a moment of earned warmth.
The fellowship has won something, found something, or simply been given a breath.
Write with warmth and relief. Let the image be exactly what it appears to be — something good.`,
};

export default TAG_RULES;