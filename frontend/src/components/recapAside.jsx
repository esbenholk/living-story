import React, { useEffect, useMemo, useState } from "react";
import { HERO_TAGS } from "../config/heroTags.js";
import { randomColorPair } from "../config/colorPairs.jsx";
import { replaceAlice, cleanText } from "../config/alias.jsx";
import Ticker from "./Ticker.jsx";
import TagIcon from "./TagIcon.jsx";

// ── The recap's fixed story beats ──────────────────────────────────────────
// The festival's own event log tags each day with a dominant archetype
// (heroTagId) that lines up almost exactly with the classic Hero's Journey:
// Day 1 avatar=HERO, Day 2 que=QUEST, Day 3 npc=MENTOR, Day 4 obsticalus=CHALLENGE,
// Day 5 abby=ABYSS, Day 6 ratava=VILLAIN, Day 7 morph=TRANSFORMATION.
// Each day below is written as one continuous beat of the fable, with a
// single real chapter.id anchor at the end rather than links mid-sentence —
// the overlay it opens always pulls the actual headline / text / image
// live from `chapters`, so it can't drift out of sync.

const BEATS = [
  {
    day: 1, stage: "HERO", title: "THE GIRL WHO ARRIVED",
    intro: `Once upon a time there was a girl who came to the festival for the music, and nothing else. She hadn't been there five minutes before `,
    parts: [
      { chapterId: "cmqz1bkjt0003clmh9vto1ush", label: "a sign lit up with her name on it, before she'd told anyone what it was" },
      { text: ". A man in mirrored sunglasses smiled at her like he already knew her secrets, and " },
      { chapterId: "cmqz1blmd0005clmhrqhk7e2n", label: "warned her, kindly, that someone was watching" },
      { text: ". She laughed it off — festivals do strange things to a person's nerves — and let a warm, easy stranger named Adam pull her into his circle instead. " },
      { chapterId: "cmqz7zhpp007hclmh0ujlo4a2", label: "He had a bracelet on his wrist that he never quite explained" },
      { text: ". She didn't ask twice." },
    ],
  },
  {
    day: 2, stage: "QUEST", title: "THE KEY SHE DIDN'T LOSE",
    intro: `By the second day the ground had started to tilt. `,
    parts: [
      { chapterId: "cmqzvwwbt000zwpl87r3nhr9m", label: "Mirrors stopped agreeing with her face — a stranger's grin would hang in the glass a beat after the stranger had gone" },
      { text: ". A hand kept tapping her shoulder and finding no one there. And then, half-buried in the dust between two tents, " },
      { chapterId: "cmr1awmwz005ph54me5gkh8bj", label: "she found a key. Not one she'd dropped. Not one she'd asked for" },
      { text: ". Adam recognised it before she'd even lifted it off the ground, and led her toward a tent she hadn't noticed until that exact moment." },
    ],
  },
  {
    day: 3, stage: "MENTOR", title: "THE OTHERS WHO NOTICED TOO",
    intro: `The key opened a door, and the door was full of people — `,
    parts: [
      { chapterId: "cmr1b7zwm005rh54mokux7z1f", label: "Emma, Tom, Mira, and later Jaz, Blonde Beard, and a woman everyone just called New Face" },
      { text: ". For one day, being frightened stopped being lonely. They compared notes: " },
      { chapterId: "cmr236o4u00elh54mhc5n20my", label: "signs that glitched mid-sentence, staff who smiled a half-second too long" },
      { text: ", a name misfiled and re-filed like someone was editing the guest list in real time. Somewhere in that tent, " },
      { chapterId: "cmr26n5ia00iph54mspv5l1ar", label: "one of them said the sentence none of them wanted to be first to say out loud — that maybe everyone here was her, in some way" },
      { text: " — and the room went quiet around it." },
    ],
  },
  {
    day: 4, stage: "CHALLENGE", title: "THE FESTIVAL STARTS GUARDING ITSELF",
    intro: `On the fourth day the festival stopped pretending to be soft. `,
    parts: [
      { chapterId: "cmr2rc53a00vlh54m6mqbcycg", label: "Robots took up posts at the tent flaps, reciting \"festival guidelines\" to anyone who lingered" },
      { text: ". Badges got checked. Paths got sealed. QR codes led nowhere on purpose. Her new friends stopped asking politely — " },
      { chapterId: "cmr3g6g8a0023ynfxl9a8af1g", label: "a hammer, a forced door, a scattered trail of paper someone clearly hadn't wanted found" },
      { text: " — and together they went further into the festival than any wristband was ever supposed to allow." },
    ],
  },
  {
    day: 5, stage: "ABYSS", title: "THE PART WHERE SHE ALMOST LET GO",
    intro: `Day five was Adam's day. He was warmer than ever, and more insistent — drinks, lights, a hand at her back guiding her toward the stage, a QR code held out like a small apology for something he hadn't said yet. "Why not let go," he kept saying, and for a while she almost did. Then, for one full second, `,
    parts: [
      { chapterId: "cmr475upq00ixynfx19x2d5p2", label: "the hand pouring her next drink wore her own face. Not similar. Hers" },
      { text: ". After that, letting go didn't sound like an invitation anymore. It sounded like a warning." },
    ],
  },
  {
    day: 6, stage: "VILLAIN", title: "THE FARM BENEATH THE FESTIVAL",
    intro: `The truth didn't arrive with a bang. It arrived as `,
    parts: [
      { chapterId: "cmr5m8ywn003jexwcaal9mp0a", label: "a bag of salad, uncannily uniform, moved by volunteers whose hands were too precise to be bored" },
      { text: ". It arrived as " },
      { chapterId: "cmr6i78e70073exwc16j17vkp", label: "Adam's own wristband, flickering in sync with a booth's screens like it had been reporting on her the entire time" },
      { text: ". And it arrived, loudest of all, from the main stage itself — " },
      { chapterId: "cmr6yfm5z0063ktp9j2joda2r", label: "the headliner's voice booming out over the crowd that everyone here was just bits and bytes, dancing to somebody else's tune, a cable running plainly from her to whatever sat behind the lights" },
      { text: ". This was never a festival. It was a farm, and she had been the crop the whole time. By the end of the day the uniforms were closing in, and " },
      { chapterId: "cmr6j42zc0077exwce5d2h73k", label: "all she had left in her hand was a sword, cold under the neon, and her own reflection waiting on the other side of it" },
      { text: "." },
    ],
  },
  {
    day: 7, stage: "TRANSFORMATION", title: "THE GIRL WHO TOOK THE MICROPHONE",
    intro: `On the seventh day she stopped running. If the festival was a machine, then the stage was its microphone, so she climbed up and took it. Rain on her face, Adam somewhere behind her with a warning in his eyes she chose not to hear, `,
    parts: [
      { chapterId: "cmr76w8qp006fktp937izaxa0", label: "she said the name out loud in front of everyone — Slop Plot — until it couldn't be quietly taken back" },
      { text: ". For one second, the whole crowd looked at her instead of their phones. Then Adam started walking toward the stage, smiling the smile that meant the show was about to be shut down. That is where the story stops, for now — mid-broadcast, mid-sentence, waiting to see what she becomes next." },
    ],
  },
];

const INTRO = `Once upon a time, at a festival that somehow already knew her name, there was a girl called Alice — and this is what happened to her, seven days at a time.`;

const OUTRO = `On the last day, Alice returned home. Weathered by the festival, but optimaxxxed by the encounters along the way`;

function getTagForChapter(chapter) {
  const heroTagId = chapter?.day;
  return HERO_TAGS.find((t) => t.day === heroTagId) || null;
}

function getCutoutImage(chapter) {
//   const cutouts = chapter?.uploadEvent?.cutouts || {};
//   if (cutouts.subject) return cutouts.subject;
  return chapter?.uploadEvent?.cloudinaryUrl.replace("/upload/", `/upload/w_${250},c_limit,q_auto,f_auto/`) || null;
}

// ── Recap link — inline clickable phrase ───────────────────────────────────

function RecapLink({ chapter, children, onOpen }) {
  const [hover, setHover] = useState(false);
  if (!chapter) return <>{children}</>; // chapter not loaded yet — degrade to plain text
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => onOpen(chapter)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(chapter); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: "pointer",
        color: hover ? "var(--highlight, #ffe600)" : "inherit",
        textDecoration: "underline",
        textDecorationColor: "var(--red)",
        textDecorationThickness: 2,
        textUnderlineOffset: 3,
        transition: "color 0.15s ease",
      }}
    >
      {children}
    </span>
  );
}

// ── Chapter overlay — full chapter + image + jump-to-Saga ──────────────────

function ChapterOverlay({ chapter, colors, onClose, onGoToChapter }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const image = getCutoutImage(chapter);
  const tag = getTagForChapter(chapter);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        // background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          cursor: "default",
          width: "100%",
          maxHeight: "90%",
          overflowY: "auto",
          background: colors.container,
          borderTop: `5px solid ${colors.headline}`,
          borderLeft: `5px solid ${colors.headline}`,
          borderRight: `5px solid ${colors.headline}`,
          padding: "5px",
          margin: "50px"
        }}
      >
        {image && (
          <div style={{ width: "100%", aspectRatio: "4/5", overflow: "hidden", background: "#000" }}>
            <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
          </div>
        )}

        <div style={{ padding: "16px 16px 0" }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            marginBottom: 10,
          }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: colors.headline, textTransform: "uppercase", fontFamily: "system-ui", fontWeight: 700 }}>
              Day {chapter.day}
            </div>
            {tag && <TagIcon tag={tag} color={colors.headline} size={24} />}
          </div>

          <div style={{
            fontSize: 26, fontWeight: 800, color: colors.headline,
            textTransform: "uppercase", lineHeight: 1.15, marginBottom: 14,
          }}>
            {replaceAlice(chapter.headline) || "…"}
          </div>
        </div>

        <div style={{ background: colors.headline, padding: "14px 16px 18px" }}>
          <p style={{ color: colors.text, fontSize: 14, lineHeight: 1.6 }}>
            {cleanText(chapter.text)}
          </p>

          <button
            onClick={() => { onGoToChapter(chapter.id); onClose(); }}
            style={{
              marginTop: 18,
              cursor: "pointer",
              width: "100%",
              border: `2px solid ${colors.text}`,
              background: colors.text,
              color: colors.headline,
              fontFamily: "system-ui",
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              padding: "12px 14px",
              borderRadius: 999,
            }}
          >
            View this chapter in the Saga →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function RecapAside({ chapters, currentDay, isActive, onGoToChapter }) {
  const [activeChapterId, setActiveChapterId] = useState(null);

  const byId = useMemo(() => {
    const map = new Map();
    for (const ch of chapters) map.set(ch.id, ch);
    return map;
  }, [chapters]);

  // Stable color per day-section, assigned once
  const colorByDay = useMemo(() => {
    const map = new Map();
    for (const b of BEATS) map.set(b.day, randomColorPair());
    return map;
  }, []);

  const activeChapter = activeChapterId ? byId.get(activeChapterId) : null;
  const activeColors = activeChapter ? colorByDay.get(activeChapter.day) || randomColorPair() : null;

  return (
    <>
      <Ticker position="left" text={`Recap · Day ${currentDay} · `} color={"var(--red)"} borderColor={"var(--red)"} />
      <Ticker position="right" text={"Every underlined word is real · "} color={"var(--red)"} borderColor={"var(--red)"} />
      <Ticker position="top" text={"The story so far, in her own words · "} color={"white"} borderColor={"var(--red)"} />

      <div
        style={{
          height: "100dvh",
          overflowY: "auto",
          padding: "45px 45px 60px",
          color: "#e5e5e5",
          background: "var(--blue)",
          lineHeight: 1,
          position: "relative",
        }}
      >
      <div style={{
        fontSize: 9, letterSpacing: 4, color: "var(--red)", textTransform: "uppercase",
        fontFamily: "system-ui", fontWeight: 700, marginBottom: 32,
      }}>
        The Slop Plot · Recap
      </div>

      <p style={{ fontSize: 18, lineHeight: 1.6, fontStyle: "italic", color: "#e5e5e5", marginBottom: 40 }}>
        {replaceAlice(INTRO)}
      </p>

      {BEATS.map((beat) => {
        const colors = colorByDay.get(beat.day);
        return (
          <div key={beat.day} style={{ marginBottom: 40 }}>
            <div style={{
              fontSize: 9, letterSpacing: 4, color: "var(--red)", textTransform: "uppercase",
              fontFamily: "system-ui", fontWeight: 700, marginBottom: 10,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span>Day {beat.day}{beat.day === currentDay ? " · Now" : ""}</span>
              <span style={{ color: "rgba(255,255,255,0.35)", letterSpacing: 2 }}>{beat.stage}</span>
            </div>
            <div style={{
              fontSize: 20, fontWeight: 800, color: colors.headline, textTransform: "uppercase",
              letterSpacing: 0.5, marginBottom: 10,
            }}>
              {beat.title}
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: "#e5e5e5" }}>
              {replaceAlice(beat.intro)}
              {beat.parts.map((part, i) =>
                part.chapterId ? (
                  <RecapLink key={i} chapter={byId.get(part.chapterId)} onOpen={(ch) => setActiveChapterId(ch.id)}>
                    {replaceAlice(part.label)}
                  </RecapLink>
                ) : (
                  <React.Fragment key={i}>{replaceAlice(part.text)}</React.Fragment>
                )
              )}
            </p>
          </div>
        );
      })}

      <p style={{ fontSize: 16, lineHeight: 1.6, fontStyle: "italic", color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
        {replaceAlice(OUTRO)}
      </p>


      {activeChapter && (
        <ChapterOverlay
          chapter={activeChapter}
          colors={activeColors}
          onClose={() => setActiveChapterId(null)}
          onGoToChapter={onGoToChapter}
        />
      )}
      </div>
    </>
  );
}