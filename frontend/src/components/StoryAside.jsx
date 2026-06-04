import React, { useEffect, useRef, useMemo } from "react";
import { HERO_TAGS } from "../config/heroTags.js";
import Ticker from "./Ticker.jsx";
import TagIcon from "./TagIcon.jsx";


// ── Color palette — pairs that contrast well against each other ───────────

const COLOR_PAIRS = [
{ headline: "#ffe600", container: "#FF3400", text: "#3700ff" },
{ headline: "#FF3400", container: "#3700ff", text: "#ffe600" },
{ headline: "#00ff00", container: "#111111", text: "#FF3400" },
{ headline: "#FF3400", container: "#2f00ff", text: "#00ff00" },
{ headline: "#FF3400", container: "#111111", text: "#00ff00" },
{ headline: "#ffe600", container: "#FF3400", text: "#2f00ff" },
{ headline: "#000000", container: "#FF3400", text: "#ffffff" },
];

const ALIAS_NAMES = [
  "SISSYFOS",
  "ATLAS",
  "QUERIA",
  "ANIMA",
  "TOM"
];

// Pick one alias per session — stable until page refresh
const SESSION_ALIAS = ALIAS_NAMES[Math.floor(Math.random() * ALIAS_NAMES.length)];
const SESSION_FIRST_NAME = SESSION_ALIAS.split("-")[1] || SESSION_ALIAS;
const SESSION_FIRST_NAME_CAPITALISED = 
  SESSION_FIRST_NAME.charAt(0).toUpperCase() + SESSION_FIRST_NAME.slice(1).toLowerCase();

function replaceAlice(text) {
  if (!text) return text;
  return text
    .replace(/OMNI-ALICE/g, SESSION_ALIAS)
    .replace(/Omni-Alice/g, SESSION_ALIAS)
    .replace(/omni-alice/g, SESSION_ALIAS.toLowerCase())
    .replace(/\bALICE\b/g, SESSION_FIRST_NAME)
    .replace(/\bAlice\b/g, SESSION_FIRST_NAME_CAPITALISED);
}

const tickerColor = "var(--red)";
const tickerBorderColor = "var(--red)";

const SLIDE_TICKERS = [
  {
    top: "CONGRATULATIONS, U'VE FOUND THE PLOT?",
    left: "SLOPPY SLOPPY SLOPPY",
    right: "THE ADVENTURES OF OUR DIGITAL TWIN: OMNI-ALICE",
  },
  {
    top: "Timeline · Every moment · Every face · ",
    left: "Living Story · Day {day} · ",
    right: "The archive · ",
  },
  {
    top: "The story so far · Chapter by chapter · ",
    left: "Living Story · Day {day} · ",
    right: "Words · Images · Memory · ",
  },
];

const tickerText = {
  top: SLIDE_TICKERS[0].top,
  left: SLIDE_TICKERS[0].left,
  right: SLIDE_TICKERS[0].right,
};

// ── Random color assignment ───────────────────────────────────────────────

function randomColorPair() {
  return COLOR_PAIRS[Math.floor(Math.random() * COLOR_PAIRS.length)];
}

// ── Tag icon resolver ─────────────────────────────────────────────────────

function getTagForChapter(chapter) {
  const heroTagId = chapter?.day;
  return HERO_TAGS.find(t => t.day === heroTagId) || null;
}

function getTagForEvent(chapter) {
  const heroTagId = chapter?.uploadEvent?.analysisRaw?.heroTagId;
  return HERO_TAGS.find(t => t.id === heroTagId) || null;
}

// ── Cutout image resolver ─────────────────────────────────────────────────

function getCutoutImage(chapter) {
  const cutouts = chapter.uploadEvent?.cutouts || {};

  // Priority 1: full face pack — both eyes + mouth
  if (cutouts.left_eye && cutouts.right_eye && cutouts.mouth) {
    return {
      type: "face_pack",
      left_eye: cutouts.left_eye,
      mouth: cutouts.mouth,
      right_eye: cutouts.right_eye,
    };
  }

  // Priority 2: both eyes
  if (cutouts.left_eye && cutouts.right_eye) {
    return {
      type: "eyes_pack",
      left_eye: cutouts.left_eye,
      right_eye: cutouts.right_eye,
    };
  }

  // Priority 3: subject cutout
  if (cutouts.subject) return { type: "subject", url: cutouts.subject };

  // Fallback: original image
  if (chapter.uploadEvent?.cloudinaryUrl) {
    return { type: "original", url: chapter.uploadEvent.cloudinaryUrl };
  }

  return null;
}

// ── Clean chapter text ────────────────────────────────────────────────────

function cleanText(text) {
  if (!text) return "…";
  return replaceAlice(text
    .split("\n")
    .filter(l => !l.trim().startsWith("OPERATOR_WORD"))
    .join("\n")
    .trim());
}

// ── Day divider ───────────────────────────────────────────────────────────

function DayDivider({ day, tag, currentDay }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      flexDirection: "column",
      gap: 12,
    }}>
      {tag && (
        <img
          src={`/tags/${tag.svg}`}
          alt={tag.label}
          width="100%"
          height="auto"
        />
      )}
      <div style={{
        fontSize: 9,
        width: "100%",
        letterSpacing: 4,
        color: "var(--red)",
        textTransform: "uppercase",
        fontFamily: "system-ui",
        fontWeight: 700,
        display: "flex",
        justifyContent: "space-between",
      }}>
        <div>Day {day}{day === currentDay ? " · Now" : ""}</div>
        {tag && (
          <div style={{
            fontSize: 9,
            letterSpacing: 2,
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
            fontFamily: "system-ui",
          }}>
            {tag.label}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chapter card ──────────────────────────────────────────────────────────

function ChapterCard({ chapter, colors }) {
  const cutout = getCutoutImage(chapter);
  const isPack = cutout?.type === "face_pack" || cutout?.type === "eyes_pack";
  const isSubject = cutout?.type === "subject";


  const tag = getTagForEvent(chapter);


  
  return (
    <>
    <div style={{
      background: colors.container,
      border: `5px solid colors.headline`,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      border: `5px solid ${colors.headline}`,
      borderBottom: "0px solid red",
      padding: "5px 5px",
    }}>
        {/* ── Cutout image ── */}
        {cutout && (
          <div style={{
            flexShrink: 0,
            display: "flex",
            flexDirection: "row",
            gap: 4,
            justifyContent: "space-between",
            position: "relative"
          }}>
     
            {isPack ? (
              // Render each cutout as a small circle
              Object.entries(cutout)
                .filter(([key]) => key !== "type")
                .map(([key, url]) => (
                  <div key={key} style={{
                    width: 70,
                    height: 70,
                    borderRadius: "50%",
                    overflow: "hidden",
                    backgroundColor: `${colors.headline}`,
                    flexShrink: 0,
                  }}>
                    <img
                      src={url}
                      alt={key}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={e => { e.currentTarget.parentNode.style.display = "none"; }}
                    />
                  </div>
                ))
            ) : (
              // Subject or original — single image
              <div style={{
                width: 120,
                height: 120,
                overflow: "hidden",
                width: "100%",
                borderRadius: "50%",
                overflow: "hidden",
                backgroundColor: `${colors.headline}`,
                display: "flex",
                flexDirection: "row",
                gap: 4,
                justifyContent: "center",
              }}>
                <img
                  src={cutout.url}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                  onError={e => { e.currentTarget.parentNode.style.display = "none"; }}
                />
              </div>
            )}
          </div>
        )}
        {/* ── Headline bar ── */}
        <div style={{
    
          display: "flex",
          flexDirection: "column", 
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}>
        <div style={{
          fontSize: 30,
          fontWeight: 800,
          color: colors.headline,
          fontFamily: "system-ui",
          letterSpacing: 0.5,
          textTransform: "uppercase",
          lineHeight: 1.3,
          flex: 1,
        }}>

          {replaceAlice(chapter.headline) || "…"}
      
        </div>
      </div>
    </div>
      <div style={{ background: colors.headline, padding: "5px 5px"}}>
        <p style={{
          fontSize: 17,
          color: colors.text,
          margin: 0,
          lineHeight: 0.8,
          whiteSpace: "pre-line",
        }}>
          {cleanText(chapter.text)}
        </p>

        {tag && (
              <div
                style={{marginTop: "20px", display: "flex", width: "100%", justifyContent: "flex-end"}}
              >
                <TagIcon tag={tag} color={"white"} size={32} />
              </div>
        )}
    
    </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function StoryAside({ events, chapters, currentDay, isActive }) {
  const currentRef = useRef();
  

  useEffect(() => {
    if (!isActive || !currentRef.current) return;
    const timer = setTimeout(() => {
      currentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
    return () => clearTimeout(timer);
  }, [isActive]);

  // Assign random colors once on mount — stable until page refresh
  const colorMap = useMemo(() => {
    const map = new Map();
    for (const ch of chapters) {
      map.set(ch.id, randomColorPair());
    }
    return map;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Assign colors to any new chapters that arrive after mount
  useEffect(() => {
    for (const ch of chapters) {
      if (!colorMap.has(ch.id)) {
        colorMap.set(ch.id, randomColorPair());
      }
    }
  }, [chapters, colorMap]);

  // Group chapters by day
  const byDay = useMemo(() => {
    const map = new Map();
    for (const ch of chapters) {
      if (!map.has(ch.day)) map.set(ch.day, []);
      map.get(ch.day).push(ch);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [chapters]);

  if (!chapters.length) {
    return (
      <div style={{
        height: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui",
        color: "rgba(255,255,255,0.3)",
        fontSize: 12,
        textAlign: "center",
        padding: 32,
        background: "var(--blue)",
        letterSpacing: 2,
        textTransform: "uppercase",
      }}>
        <h1>The story begins when the first image arrives.</h1>
      </div>
    );
  }

  return (
    <div style={{
      height: "100dvh",
      overflowY: "auto",
      padding: "45px 45px 60px",
      color: "#e5e5e5",
      background: "var(--blue)",
      lineHeight: 1,
    }}>

      <div style={{
        fontSize: 9,
        letterSpacing: 4,
        color: "var(--red)",
        textTransform: "uppercase",
        fontFamily: "system-ui",
        fontWeight: 700,
        marginBottom: 32,
      }}>
        The Slop Plot · Live Saga
      </div>

      {byDay.map(([day, dayChapters]) => {
        const firstTag = getTagForChapter(dayChapters[0]);

        return (
          <React.Fragment key={day}>
            <div
              id={`story-day-${day}`}
              ref={day === currentDay ? currentRef : null}
              style={{ marginBottom: 48 }}
            >
              <DayDivider day={day} tag={firstTag} currentDay={currentDay} />

              {dayChapters.map((chapter, i) => {
                const colors = randomColorPair();
                return (
                  <ChapterCard
                    key={chapter.id || i}
                    chapter={chapter}
                    colors={colors}
                  />
                );
              })}
            </div>

            <Ticker
              position="left"
              text={replaceAlice(tickerText.left.replace("{day}", currentDay))}
              color={tickerColor}
              borderColor={tickerBorderColor}
            />
            <Ticker
              position="right"
              text={replaceAlice(tickerText.right.replace("{day}", currentDay))}
              color={tickerColor}
              borderColor={tickerBorderColor}
            />
            <Ticker
              position="top"
              text={replaceAlice(tickerText.top.replace("{day}", currentDay))}
              color={"white"}
              borderColor={tickerBorderColor}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}