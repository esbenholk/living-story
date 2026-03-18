import React, { useEffect, useRef, useMemo, useState } from "react";
import { HERO_TAGS, defaultTagForDay } from "../config/heroTags.js";
import Ticker from "./Ticker.jsx";

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  return d
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", " ·");
}

function seededRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cloudinaryResize(url, width = 200) {
  if (!url) return url;
  return url.replace("/upload/", `/upload/w_${width},c_scale,q_auto,f_auto/`);
}
// ── Layout constants ──────────────────────────────────────────────────────

const SVG_W = 300;
const ROW_H = 200;
const TOP_PAD = 80;
const BOTTOM_PAD = 100;
const CARD_W = 150;
const CARD_H = 50;
const IMG_H = 90;
const BEND_R = 16;
const MARGIN = 20;
const PAGE_SIZE = 50;

// The ellipse clip is slightly inset from the card rect so the
// border ellipse and the clip match exactly
const ELL_RX = CARD_W / 2; // full half-width
const ELL_RY = CARD_H / 2; // full half-height

// ── Path builder ──────────────────────────────────────────────────────────

function buildPath(x1, y1, x2, y2, midY) {
  const r = BEND_R;
  const dx = x2 - x1;
  const sx = Math.sign(dx) || 1;
  const clampedMid = Math.max(y1 + r * 2, Math.min(y2 - r * 2, midY));
  const c1x = x1,
    c1y = clampedMid;
  const c2x = x2,
    c2y = clampedMid;
  return [
    `M ${x1} ${y1}`,
    `L ${c1x} ${c1y - r}`,
    `C ${c1x} ${c1y} ${c1x} ${c1y} ${c1x + sx * r} ${c1y}`,
    Math.abs(dx) > r * 2 ? `L ${c2x - sx * r} ${c2y}` : "",
    `C ${c2x} ${c2y} ${c2x} ${c2y} ${c2x} ${c2y + r}`,
    `L ${x2} ${y2}`,
  ]
    .filter(Boolean)
    .join(" ");
}

// ── Component ─────────────────────────────────────────────────────────────

export default function TimelineAside({ events, currentDay, isActive }) {
  const scrollRef = useRef();
  const currentRef = useRef();
  const sentinelRefs = useRef({});

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [scrollDay, setScrollDay] = useState(currentDay);

  const visibleEvents = useMemo(
    () => events.slice(0, visibleCount),
    [events, visibleCount],
  );
  const hasMore = visibleCount < events.length;

  useEffect(() => {
    if (isActive && currentRef.current) {
      currentRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
    console.log("timeline", events);
  }, [isActive]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const idx = Number(visible[0].target.dataset.idx);
          const ev = visibleEvents[idx];
          if (ev) setScrollDay(ev.day);
        }
      },
      { root, threshold: 0.3 },
    );
    const nodes = Object.values(sentinelRefs.current);
    nodes.forEach((n) => n && observer.observe(n));
    return () => observer.disconnect();
  }, [visibleEvents]);

  useEffect(() => {
    if (currentDay) setScrollDay(currentDay);
  }, [currentDay]);

  // ── Layout ────────────────────────────────────────────────────────────
  const laid = useMemo(() => {
    const rng = seededRng(7);
    return visibleEvents.map((ev, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const xBias = side * (SVG_W * 0.18);
      const xJitter = (rng() - 0.5) * (SVG_W * 0.55);
      const rawX = SVG_W / 2 + xBias + xJitter;
      const cx = Math.max(
        CARD_W / 2 + MARGIN,
        Math.min(SVG_W - CARD_W / 2 - MARGIN, rawX),
      );
      const yJitter = (rng() - 0.5) * ROW_H * 0.7;
      const cy = TOP_PAD + i * ROW_H + yJitter;
      return { ev, i, cx, cy };
    });
  }, [visibleEvents]);

  const svgH =
    TOP_PAD +
    Math.max(visibleEvents.length - 1, 0) * ROW_H +
    CARD_H +
    BOTTOM_PAD;

  const paths = useMemo(() => {
    const rng = seededRng(13);
    return laid.slice(0, -1).map((a, i) => {
      const b = laid[i + 1];
      const x1 = a.cx,
        y1 = a.cy + CARD_H / 2 + 4;
      const x2 = b.cx,
        y2 = b.cy - CARD_H / 2 - 4;
      const midY = y1 + (y2 - y1) * (0.35 + rng() * 0.3);
      return buildPath(x1, y1, x2, y2, midY);
    });
  }, [laid]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div
      ref={scrollRef}
      style={{
        height: "100dvh",
        overflowY: "auto",
        overflowX: "clip",
        background: "var(--blue)",
        fontFamily: "system-ui, sans-serif",
        scrollbarWidth: "none",
        position: "relative",
      }}
    >
      {/* Sticky header */}
      <Ticker
        position="top"
        text={"the plot database"}
        color={"var(--highlight)"}
      />
      <div
        style={{
          position: "absolute",
          width: "100%",
          top: 40,
          zIndex: 20,
          background: "var(--highlight)",
          height: 40,
          border: "var(--borderwidth) solid var(--red)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: 3,
            color: "var(--red)",
            textTransform: "uppercase",
            fontWeight: 400,
          }}
        >
          The Plotline
        </h1>
        <span
          style={{
            fontSize: 11,
            letterSpacing: 2,
            color: "var(--red)",
            textTransform: "uppercase",
          }}
        >
          Day {scrollDay}
        </span>
      </div>

      {events.length === 0 && (
        <p
          style={{
            color: "#333",
            fontSize: 13,
            marginTop: 80,
            textAlign: "center",
            letterSpacing: 1,
          }}
        >
          No uploads yet — be the first.
        </p>
      )}

      {hasMore && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "16px 0 0",
          }}
        >
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            style={{
              background: "transparent",
              border: "1px solid var(--red)",
              color: "var(--red)",
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              padding: "8px 20px",
              cursor: "pointer",
              borderRadius: 2,
            }}
          >
            Load {Math.min(PAGE_SIZE, events.length - visibleCount)} more
          </button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg
          width={SVG_W}
          height={svgH}
          viewBox={`0 0 ${SVG_W} ${svgH}`}
          style={{
            overflow: "visible",
            touchAction: "pan-y",
            userSelect: "none",
          }}
        >
          {/* Connecting paths */}
          {paths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="var(--red)"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Node dots */}
          {laid.map(({ cx, cy, ev }) => (
            <circle
              key={`dot-${ev.id || cy}`}
              cx={cx}
              cy={cy}
              r={4}
              fill="var(--red)"
            />
          ))}

          {/* ── Event cards ─────────────────────────────────────────── */}
          {laid.map(({ ev, i, cx, cy }) => {
            const isCurrentDay = ev.day === currentDay;
            const subjectUrl = ev.cutouts?.subject;
            const imgUrl = subjectUrl || ev.cloudinaryUrl;
            const dateLabel = ev.analysisRaw?.created_at;
            const desc =
              ev.descriptionShort ||
              ev.analysisRaw?.descriptionShort ||
              ev.description ||
              ev.analysisRaw?.description ||
              "";

            // Resolve hero tag: socket events carry heroTagId directly,
            // DB-loaded events carry it inside analysisRaw
            const heroTagId = ev.heroTagId || ev.analysisRaw?.heroTagId || null;
            const heroTag = heroTagId
              ? HERO_TAGS.find((t) => t.id === heroTagId) ||
                defaultTagForDay(ev.day)
              : defaultTagForDay(ev.day);

            // Tag SVG — seeded random position inside the ellipse
            const tagRng = seededRng((i + 250) * 2500);
            const angle = tagRng() * Math.PI * 2;
            const TAG_SIZE = 50;
            const dist = tagRng() * Math.min(ELL_RX, ELL_RY) * 5;

            const sizeRng = seededRng((i + 1) * 137);
            const rx = ELL_RX * (0.7 + sizeRng() * 1.7); // 30%–200% of base width
            const ry = ELL_RY * (0.7 + sizeRng() * 1.7); // independent call = different proportion

            // Is this the first event of the current day (for scroll anchor)?
            const isAnchor =
              isCurrentDay &&
              i === visibleEvents.findIndex((e) => e.day === currentDay);

            const textRng = seededRng(i * 1337 + 42);
            const textRight = textRng() > 0.5;

            return (
              <g key={ev.id || i} overflow="visible">
                <defs overflow="visible">
                  <clipPath id={`ellclip-${i}`}>
                    <ellipse cx={cx} cy={cy} rx={rx - 2} ry={ry - 2} />
                  </clipPath>
                </defs>

                {/* Ellipse border */}
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={ry}
                  fill="var(--blue)"
                  stroke="var(--red)"
                  strokeWidth={5}
                  overflow="visible"
                />

                {/* Image — centred on cx/cy, sized to the actual rx/ry */}
                {imgUrl && imgUrl.length > 1 && (
                  <image
                    href={cloudinaryResize(imgUrl, 200)}
                    x={cx - rx}
                    y={cy - ry}
                    width={rx * 2}
                    height={ry * 2}
                    preserveAspectRatio={
                      subjectUrl ? "xMidYMid meet" : "xMidYMid slice"
                    }
                    clipPath={`url(#ellclip-${i})`}
                    style={{
                      filter:
                        "brightness(0) saturate(100%) invert(76%) sepia(99%) saturate(600%) hue-rotate(60deg) brightness(100%)",
                    }}
                  />
                )}

                {/* Text below the actual ellipse bottom edge */}

                <foreignObject
                  x={textRight ? cx : cx - rx}
                  y={cy - ry - 70 / 1.5}
                  width={rx + 25}
                  height={"auto"}
                  overflow={"visible"}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: textRight ? "row-reverse" : "row",
                      gap: 4,
                      marginTop: 4,
                    }}
                  >
                    {(ev.analysisRaw?.colors || [])
                      .slice(0, 3)
                      .filter((c) => c[0])
                      .map((c, ci) => {
                        const amount = c[1];
                        const dotR = 3 + (amount / 40) * 5; // 3–9px radius
                        return (
                          <div
                            key={ci}
                            style={{
                              width: dotR * 2,
                              height: dotR * 2,
                              borderRadius: "50%",
                              background: c[0],
                              flexShrink: 0,
                              alignSelf: "center",
                            }}
                          />
                        );
                      })}
                  </div>

                  <div
                    xmlns="http://www.w3.org/1999/xhtml"
                    ref={(el) => {
                      sentinelRefs.current[i] = el;
                      if (isAnchor) currentRef.current = el;
                    }}
                    data-idx={i}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      textAlign: textRight ? "right" : "left",
                    }}
                  >
                    {desc && (
                      <div
                        style={{
                          fontSize: 13,
                          color: "white",
                          lineHeight: 1.35,
                          fontStyle: "italic",
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          // overflow: "hidden",
                        }}
                      >
                        {desc}
                      </div>
                    )}
                  </div>

                  {dateLabel && (
                    <div
                      style={{
                        fontSize: 6,
                        color: "white",
                        letterSpacing: 1,
                        top: -3,
                        opacity: 0.5,
                        left: textRight ? "0" : "-13px",
                        right: textRight ? "-13px" : "0px",
                        position: "absolute",

                        transform: textRight
                          ? "rotate(-90deg)"
                          : "rotate(90deg)",
                        transformOrigin: textRight
                          ? "right center"
                          : "left center",
                        textAlign: textRight ? "right" : "left",
                      }}
                    >
                      {dateLabel}
                    </div>
                  )}
                </foreignObject>

                {/* Tag SVG — random position using actual rx/ry */}
                {/* Hero tag SVG — floats just outside ellipse edge */}
                <image
                  href={`/src/assets/tags/${heroTag.svg}`}
                  x={cx + rx * 2.55 * Math.cos(angle) - TAG_SIZE / 2}
                  y={cy + ry * 2.55 * Math.sin(angle) - TAG_SIZE / 2}
                  width={TAG_SIZE}
                  height={TAG_SIZE}
                  style={{ opacity: 1 }}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
