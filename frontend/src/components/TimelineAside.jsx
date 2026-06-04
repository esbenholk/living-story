import React, { useEffect, useRef, useMemo, useState } from "react";
import { HERO_TAGS, defaultTagForDay } from "../config/heroTags.js";
import Ticker from "./Ticker.jsx";

// ── Helpers ───────────────────────────────────────────────────────────────

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

const SVG_W = 500;
const ROW_H = 280;
const TOP_PAD = 150;
const BOTTOM_PAD = 100;
const CARD_W = 180;
const CARD_H = 80;
const BEND_R = 16;
const MARGIN = 40;
const PAGE_SIZE = 50;

const ELL_RX = CARD_W / 2;
const ELL_RY = CARD_H / 2;

// ── Path builder ──────────────────────────────────────────────────────────

function buildPath(x1, y1, x2, y2, midY) {
  const r = BEND_R;
  const dx = x2 - x1;
  const sx = Math.sign(dx) || 1;
  const clampedMid = Math.max(y1 + r * 2, Math.min(y2 - r * 2, midY));
  const c1x = x1, c1y = clampedMid;
  const c2x = x2, c2y = clampedMid;
  return [
    `M ${x1} ${y1}`,
    `L ${c1x} ${c1y - r}`,
    `C ${c1x} ${c1y} ${c1x} ${c1y} ${c1x + sx * r} ${c1y}`,
    Math.abs(dx) > r * 2 ? `L ${c2x - sx * r} ${c2y}` : "",
    `C ${c2x} ${c2y} ${c2x} ${c2y} ${c2x} ${c2y + r}`,
    `L ${x2} ${y2}`,
  ].filter(Boolean).join(" ");
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
    if (!isActive || !scrollRef.current) return;
    const timer = setTimeout(() => {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 400);
    return () => clearTimeout(timer);
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
        const last = visible[visible.length - 1];
        const idx = Number(last.target.dataset.idx);
        const ev = visibleEvents[idx];
        if (ev) setScrollDay(ev.day);
      }
    },
    { 
      root,
      rootMargin: "-80px 0px 0px 0px", // ← exclude the sticky header height from top
      threshold: 0.3,
    },
  );
    const nodes = Object.values(sentinelRefs.current);
    nodes.forEach((n) => n && observer.observe(n));
    return () => observer.disconnect();
  }, [visibleEvents]);

  useEffect(() => {
    if (currentDay) setScrollDay(currentDay);
  }, [currentDay]);

  // ── Layout — rx/ry computed here so cx can use them ──────────────────
  const laid = useMemo(() => {
    const rng = seededRng(7);
    return visibleEvents.map((ev, i) => {
      // Size first
      const sizeRng = seededRng((i + 1) * 137);
      const rx = ELL_RX * (0.8 + sizeRng() * 1.0);
      const ry = ELL_RY * (0.8 + sizeRng() * 1.0);

      // Position — clamp cx using actual rx
      const side = i % 2 === 0 ? -1 : 1;
      const xBias = side * (SVG_W * 0.05);
      const xJitter = (rng() - 0.5) * (SVG_W * 0.55);
      const rawX = SVG_W / 2 + xBias + xJitter;
      const cx = Math.max(
        rx + MARGIN,
        Math.min(SVG_W - rx - MARGIN, rawX),
      );

      const yJitter = (rng() - 0.5) * ROW_H * 0.7;
      const cy = TOP_PAD + i * ROW_H + yJitter;

      return { ev, i, cx, cy, rx, ry };
    });
  }, [visibleEvents]);

  // ── Flicker image pool ────────────────────────────────────────────────────

  const [flickerUrl, setFlickerUrl] = useState(null);
  const [flickerVisible, setFlickerVisible] = useState(false);
  const flickerPoolRef = useRef([]);
  const flickerIntervalRef = useRef(null);
  const scrollTimerRef = useRef(null);

  // Keep pool in sync with visible events
  useEffect(() => {
    const urls = visibleEvents
      .map(ev => ev.cloudinaryUrl)
      .filter(Boolean);
    flickerPoolRef.current = urls;

    console.log("searching for event url", urls);
    
  }, [visibleEvents]);

  // Start/stop the flicker interval on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function startFlicker() {
      if (flickerIntervalRef.current) return; // already running
      setFlickerVisible(true);

      // Pick immediately, then on interval
      const pick = () => {
        const pool = flickerPoolRef.current;
        if (!pool.length) return;
        const url = pool[Math.floor(Math.random() * pool.length)];
        setFlickerUrl(url);
      };

      pick();
      flickerIntervalRef.current = setInterval(pick, 12); // flicker speed in ms
    }

    function stopFlicker() {
      clearInterval(flickerIntervalRef.current);
      flickerIntervalRef.current = null;
      setFlickerVisible(false);
    }

    function onScroll() {
      startFlicker();
      clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(stopFlicker, 400); // stop 400ms after scroll ends
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearInterval(flickerIntervalRef.current);
      clearTimeout(scrollTimerRef.current);
    };
  }, []);

  const svgH =
    TOP_PAD +
    Math.max(visibleEvents.length - 1, 0) * ROW_H +
    CARD_H +
    BOTTOM_PAD;

  const paths = useMemo(() => {
    const rng = seededRng(13);
    return laid.slice(0, -1).map((a, i) => {
      const b = laid[i + 1];
      const x1 = a.cx, y1 = a.cy + a.ry + 4;
      const x2 = b.cx, y2 = b.cy - b.ry - 4;
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
      <div style={{ position: "sticky", width: "100%", top: 0, zIndex: 20 }}>
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
          <h1 style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: 3,
            color: "var(--red)",
            textTransform: "uppercase",
            fontWeight: 400,
          }}>
            The Plotline
          </h1>
          <span style={{
            fontSize: 11,
            letterSpacing: 2,
            color: "var(--red)",
            textTransform: "uppercase",
          }}>
            Day {scrollDay}
          </span>
        </div>
      </div>

      {events.length === 0 && (
        <p style={{
          color: "#333",
          fontSize: 13,
          marginTop: 80,
          textAlign: "center",
          letterSpacing: 1,
        }}>
          No uploads yet — be the first.
        </p>
      )}

      {hasMore && (
        <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 0" }}>
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

      {/* ── Flicker image ── */}
      <div style={{
        position: "fixed",
        top: "0px",
        left: "0px",
        // transform: "translate(-50%, -50%)",
        right: "0px",
        bottom: "0px",
        // maxWidth: 400,
        // aspectRatio: "1",
        pointerEvents: "none",
        zIndex: 10,
        opacity: flickerVisible ? 1 : 0,
        transition: "opacity 0.15s ease",
        mixBlendMode: "screen",
      }}>
        {flickerUrl && (
          <img
            src={cloudinaryResize(flickerUrl, 600)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "fill",
              // filter: "brightness(0) saturate(100%) invert(76%) sepia(99%) saturate(600%) hue-rotate(60deg) brightness(100%)",
            }}
            alt=""
          />
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg
          width={SVG_W}
          height={svgH}
          viewBox={`0 0 ${SVG_W} ${svgH}`}
          style={{ overflow: "visible", touchAction: "pan-y", userSelect: "none" }}
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

          {/* ── Event cards ── */}
          {laid.map(({ ev, i, cx, cy, rx, ry }) => {
            const isCurrentDay = ev.day === currentDay;
            const subjectUrl = ev.cutouts?.subject;
            const imgUrl = subjectUrl || ev.cloudinaryUrl;
            const desc =
              ev.descriptionShort ||
              ev.analysisRaw?.descriptionShort ||
              "";

            const heroTagId = ev.heroTagId || ev.analysisRaw?.heroTagId || null;
            const heroTag = heroTagId
              ? HERO_TAGS.find((t) => t.id === heroTagId) || defaultTagForDay(ev.day)
              : defaultTagForDay(ev.day);

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

                {/* Image */}
                {imgUrl && imgUrl.length > 1 && (
                  <image
                    href={cloudinaryResize(imgUrl, 200)}
                    x={cx - rx}
                    y={cy - ry}
                    width={rx * 2}
                    height={ry * 2}
                    preserveAspectRatio={subjectUrl ? "xMidYMid meet" : "xMidYMid slice"}
                    clipPath={`url(#ellclip-${i})`}
                    style={{
                      filter: "brightness(0) saturate(100%) invert(76%) sepia(99%) saturate(600%) hue-rotate(60deg) brightness(100%)",
                    }}
                  />
                )}

                {/* Description text */}
                <foreignObject
                  x={textRight ? cx : cx - rx}
                  y={cy - ry - 70 / 1.5}
                  width={rx + 25}
                  height={"auto"}
                  overflow={"visible"}
                >
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
                      <div style={{
                        fontSize: 8,
                        color: "white",
                        lineHeight: 0.9,
                        fontStyle: "italic",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                      }}>
                        {desc}
                      </div>
                    )}
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}