import React, { useEffect, useRef, useMemo, useState } from "react";
import { HERO_TAGS } from "../config/heroTags.js";
import { COLOR_PAIRS, randomColorPair } from "../config/colorPairs.jsx";
import { SESSION_ALIAS, replaceAlice, cleanText } from "../config/alias.jsx";
import { cloudinaryResize } from "../config/cloudinary.jsx";
import Ticker from "./Ticker.jsx";
import TagIcon from "./TagIcon.jsx";

// NOTE: ALIAS_NAMES / SESSION_ALIAS / replaceAlice / cleanText now live in
// ../utils/alias.js, and COLOR_PAIRS / randomColorPair in ../config/colorPairs.js —
// shared with RecapAside so both Asides agree on the same session alias
// and the same palette. Nothing else about their behavior changed.

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

// function randomColorPair() {
//   return COLOR_PAIRS[Math.floor(Math.random() * COLOR_PAIRS.length)];
// }

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
  // Each circle renders at 70px, so 150px (~2x retina) is plenty.
  if (cutouts.left_eye && cutouts.right_eye && cutouts.mouth) {
    return {
      type: "face_pack",
      left_eye: cloudinaryResize(cutouts.left_eye, 150),
      mouth: cloudinaryResize(cutouts.mouth, 150),
      right_eye: cloudinaryResize(cutouts.right_eye, 150),
    };
  }

  // Priority 2: both eyes
  if (cutouts.left_eye && cutouts.right_eye) {
    return {
      type: "eyes_pack",
      left_eye: cloudinaryResize(cutouts.left_eye, 150),
      right_eye: cloudinaryResize(cutouts.right_eye, 150),
    };
  }

  // Priority 3: subject cutout — renders at 120px tall, so 250px (~2x retina) is plenty.
  if (cutouts.subject) return { type: "subject", url: cloudinaryResize(cutouts.subject, 250) };

  // Fallback: original image
  if (chapter.uploadEvent?.cloudinaryUrl) {
    return { type: "original", url: cloudinaryResize(chapter.uploadEvent.cloudinaryUrl, 250) };
  }

  return null;
}

// cleanText now imported from ../utils/alias.js

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
          style={{
            width: "100%",
            maxWidth: "300px",
            height: "auto",
          }}
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

// ── Meme overlay ──────────────────────────────────────────────────────────

function MemeOverlay({ image, text, onClose }) {
  // Close on Escape + lock body scroll while open
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
        inset: 0,
        margin: "10px",
        zIndex: 2,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",

      }}
    >
      {/* Full stretched cover image */}
      {image && (
        <img
          src={image}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "fill",
          }}
          onError={e => { e.currentTarget.style.display = "none"; }}
        />
      )}

      {/* Meme text overlay */}
      {text && (
        <div style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          padding: "0 5vw",
          textAlign: "center",
          fontFamily: "Impact, system-ui, sans-serif",
          fontWeight: 900,
          textTransform: "uppercase",
          color: "#fff",
          fontSize: "clamp(28px, 7vw, 90px)",
          lineHeight: 1.05,
          letterSpacing: 1,
          WebkitTextStroke: "1px var(--red)",
          textShadow: "0 2px 10px rgba(0,0,0,0.65)",
          pointerEvents: "none",
        }}>
          {replaceAlice(text)}
        </div>
      )}


        
            <button
              onClick={e => { e.stopPropagation(); onClose(); }}
              style={{
                cursor: "pointer",
                position: "absolute",
                bottom: -5,
                left: -5,
                border: `2px solid var(--red)`,
                background: "var(--blue)",
                color: "white",
                fontFamily: "system-ui",
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                padding: "8px 14px",
                borderRadius: 999,
              }}
            >
              Vers
            </button>
       


    </div>
  );
}

// ── Chapter card ──────────────────────────────────────────────────────────

function ChapterCard({ chapter, colors }) {
  const cutout = getCutoutImage(chapter);
  const isPack = cutout?.type === "face_pack" || cutout?.type === "eyes_pack";
  const isSubject = cutout?.type === "subject";


  const tag = getTagForEvent(chapter);

  // ── Meme overlay state ──
  const [memeOpen, setMemeOpen] = useState(false);
  const memeImage = cloudinaryResize(chapter.uploadEvent?.cloudinaryUrl, 1200);
  const memeText = chapter.uploadEvent?.analysisRaw?.memeText;
  const hasMeme = Boolean(memeImage && memeText);


  
  return (
    <div id={`chapter-${chapter.id}`} style={{position: "relative"}}>
    <div style={{
      background: colors.container,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      borderTop: `5px solid ${colors.headline}`,
      borderLeft: `5px solid ${colors.headline}`,
      borderRight: `5px solid ${colors.headline}`,

      borderBottom: "0px solid red",
      padding: "5px 5px",
      position: "relative"
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
                height: 120,
                overflow: "hidden",
                width: "100%",
                borderRadius: "50%",
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
          color: colors.text
        }} className="responsiveText">
          {cleanText(chapter.text)}
        </p>

        {/* ── Footer row: meme button (bottom-left) + tag (bottom-right) ── */}
        <div style={{
          marginTop: 20,
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          {hasMeme ? (
            <button
              onClick={() => setMemeOpen(true)}
              style={{
                cursor: "pointer",
                border: `2px solid ${colors.text}`,
                background: colors.text,
                color: colors.headline,
                fontFamily: "system-ui",
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                padding: "8px 14px",
                borderRadius: 999,
              }}
            >
              Meme
            </button>
          ) : <span />}

          {tag ? (
            <TagIcon tag={tag} color={"white"} size={32} />
          ) : <span />}
        </div>

        {/* ── meme-overlay ── */}
   
        
    </div>

         {memeOpen && (
          <MemeOverlay
            image={memeImage}
            text={memeText}
            onClose={() => setMemeOpen(false)}
          />
        )}


    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function StoryAside({ events, chapters, currentDay, isActive, focusChapterId, onDidFocusChapter }) {
  const currentRef = useRef();
  
  const scrollRef = useRef();


  // Scroll to bottom (latest chapter) when this Aside becomes active —
  // but not if we've been asked to focus a specific chapter instead (see below).
  useEffect(() => {
    if (!isActive || !scrollRef.current || focusChapterId) return;
    const timer = setTimeout(() => {
      const el = scrollRef.current;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, 400);
    return () => clearTimeout(timer);
  }, [isActive, focusChapterId]);

  // Scroll to one specific chapter — used when RecapAside sends the user
  // here via "View in the Saga". Polls briefly for the target chapter's
  // element (it may not be mounted yet the instant the slide switches),
  // then scrolls scrollRef directly to it and clears the request.
  //
  // Deliberately NOT using element.scrollIntoView(): it walks up every
  // ancestor with non-visible overflow — including Swiper's horizontal
  // wrapper — and can nudge its scroll position even though Swiper positions
  // slides with CSS transforms, not native scrolling. That mismatch is what
  // previously left the view stuck between the two Asides.
  useEffect(() => {
    if (!isActive || !focusChapterId || !scrollRef.current) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20; // ~2s at 100ms apart — covers slide transition + render

    const tryScroll = () => {
      if (cancelled) return;
      const container = scrollRef.current;
      const el = container && document.getElementById(`chapter-${focusChapterId}`);

      if (el) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const targetTop =
          elRect.top - containerRect.top + container.scrollTop
          - (container.clientHeight / 2) + (elRect.height / 2);
        container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
        if (onDidFocusChapter) onDidFocusChapter();
        return;
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        // Gave up — chapter isn't in the DOM. Still clear the request so
        // it doesn't linger and silently retry forever.
        if (onDidFocusChapter) onDidFocusChapter();
        return;
      }
      setTimeout(tryScroll, 100);
    };

    const timer = setTimeout(tryScroll, 400); // let the slide transition start
    return () => { cancelled = true; clearTimeout(timer); };
  }, [isActive, focusChapterId, onDidFocusChapter]);

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
    <div
      ref={scrollRef}
      style={{
        height: "100dvh",
        overflowY: "auto",
        padding: "45px 45px 60px",
        color: "#e5e5e5",
        background: "var(--blue)",
        lineHeight: 1,
      }}
    >

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