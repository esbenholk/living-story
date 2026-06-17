import React, { useEffect, useRef, useMemo, useState } from "react";
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

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Layout constants ──────────────────────────────────────────────────────

const TOP_PAD = 150;
const BOTTOM_PAD = 100;
const BEND_R = 16;
const PAGE_SIZE = 50;

// ── Responsive tuning (these are the knobs you asked about) ────────────────

// Meme WIDTH — scales with the panel width, then capped:
const MEME_W_FRAC = 0.8;   // meme width = this fraction of the panel width …
const MEME_W_MIN = 120;     // … but never smaller than this …
const MEME_W_MAX = 220;     // … and never larger than this.

// Horizontal SCATTER — how wide the memes spread across the page:
const SCATTER_SPAN = 0.55;  // ← THE SCATTER SPAN (fraction of panel width)
const SCATTER_BIAS = 0.05;  // gentle alternating left/right nudge
const EDGE = 12;            // keep memes at least this far from the side edges

// Vertical SPACING — the min distance between memes (prevents overlap):
const GAP_FRAC = 0.55;      // base gap = this fraction of the meme width …
const GAP_MIN = 70;         // … but never tighter than this (px) …
const GAP_JITTER = 0.45;    // … plus organic extra, up to this fraction of base.

const DEFAULT_ASPECT = 1;   // assumed width/height until the image loads
const MOBILE_BP = 600;      // panel narrower than this counts as "mobile"

// Meta NOTES — small white labels beside each meme:
const NOTE_GAP = 8;         // gap between the meme edge and the notes
const NOTE_MIN_W = 40;      // hide the notes if there's less room than this
const DESC_MAX_CHARS = 140; // hard cut-off for the description text
const DESC_MAX_W = 200;     // desktop max width for the description (px)

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

  // Measured panel width — drives all the responsive sizing
  const [W, setW] = useState(() =>
    typeof window !== "undefined" ? Math.min(window.innerWidth, 500) : 420,
  );
  // Measured image aspect ratios (width / height), keyed by event
  const [aspects, setAspects] = useState({});

  const visibleEvents = useMemo(
    () => events.slice(0, visibleCount),
    [events, visibleCount],
  );
  const hasMore = visibleCount < events.length;

  // ── Derived responsive values ──
  const isMobile = W < MOBILE_BP;
  const memeW = useMemo(() => {
    let w = clamp(W * MEME_W_FRAC, MEME_W_MIN, MEME_W_MAX);
    w = Math.min(w, W - 2 * EDGE); // never wider than the panel
    return Math.round(w);
  }, [W]);
  const captionFont = isMobile ? 16 : 30;

  // ── Measure the panel width (responsive to device) ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const apply = () => setW(el.clientWidth || 420);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // ── Flicker image pool ────────────────────────────────────────────────
  const [flickerUrl, setFlickerUrl] = useState(null);
  const [flickerVisible, setFlickerVisible] = useState(false);
  const flickerPoolRef = useRef([]);
  const flickerIntervalRef = useRef(null);
  const scrollTimerRef = useRef(null);

  // Keep pool in sync with visible events
  useEffect(() => {
    flickerPoolRef.current = visibleEvents
      .map((ev) => ev.cloudinaryUrl)
      .filter(Boolean);
  }, [visibleEvents]);

  // Start/stop the flicker interval on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function startFlicker() {
      if (flickerIntervalRef.current) return; // already running
      setFlickerVisible(true);
      const pick = () => {
        const pool = flickerPoolRef.current;
        if (!pool.length) return;
        setFlickerUrl(pool[Math.floor(Math.random() * pool.length)]);
      };
      pick();
      flickerIntervalRef.current = setInterval(pick, 12); // flicker speed (ms)
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

  // Record each image's real aspect ratio once it loads → drives its height
  const handleImgLoad = (key) => (e) => {
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    setAspects((prev) => (prev[key] === ratio ? prev : { ...prev, [key]: ratio }));
  };

  // ── Layout — vertical stacking so memes never overlap ──────────────────
  const laid = useMemo(() => {
    const rng = seededRng(7);
    const items = [];
    let cursor = TOP_PAD; // running y = bottom edge of the previous meme

    // Min distance: responsive to device width (memeW) …
    const baseGap = Math.max(GAP_MIN, memeW * GAP_FRAC);

    for (let i = 0; i < visibleEvents.length; i++) {
      const ev = visibleEvents[i];
      const key = ev.id ?? i;

      // … and responsive to image height (its own proportions)
      const aspect = aspects[key] || DEFAULT_ASPECT;
      const h = memeW / aspect;
      const halfH = h / 2;

      // Horizontal scatter
      const side = i % 2 === 0 ? -1 : 1;
      const rawX =
        W / 2 + side * W * SCATTER_BIAS + (rng() - 0.5) * W * SCATTER_SPAN;
      const cx = clamp(rawX, memeW / 2 + EDGE, W - memeW / 2 - EDGE);

      // Vertical placement: previous bottom + gap + this meme's half height
      const gap = baseGap * (1 + rng() * GAP_JITTER);
      const cy = i === 0 ? TOP_PAD + halfH : cursor + gap + halfH;
      cursor = cy + halfH;

      items.push({ ev, i, key, cx, cy, w: memeW, h, halfH });
    }
    return items;
  }, [visibleEvents, aspects, W, memeW]);

  const svgH =
    (laid.length
      ? laid[laid.length - 1].cy + laid[laid.length - 1].halfH
      : TOP_PAD) + BOTTOM_PAD;

  const paths = useMemo(() => {
    const rng = seededRng(13);
    return laid.slice(0, -1).map((a, i) => {
      const b = laid[i + 1];
      const x1 = a.cx, y1 = a.cy + a.halfH + 4;
      const x2 = b.cx, y2 = b.cy - b.halfH - 4;
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
            THE FEED
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
        right: "0px",
        bottom: "0px",
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
            }}
            alt=""
          />
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg
          width={W}
          height={svgH}
          viewBox={`0 0 ${W} ${svgH}`}
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

          {/* ── Meme cards — natural proportions, capped width, no overlap ── */}
          {laid.map(({ ev, i, key, cx, cy, w, h }) => {
            const isCurrentDay = ev.day === currentDay;

            const memeImg = ev.cloudinaryUrl;
            const memeText = ev.analysisRaw?.memeText || "";

            const isAnchor =
              isCurrentDay &&
              i === visibleEvents.findIndex((e) => e.day === currentDay);

            // ── Meta notes (date · day · short description) ──
            const dateStr = formatDate(
              ev.createdAt ?? ev.timestamp ?? ev.date ?? ev.uploadedAt,
            );
            const desc = (
              ev.descriptionShort ||
              ev.analysisRaw?.descriptionShort ||
              ""
            ).slice(0, DESC_MAX_CHARS).trimEnd();

            // Notes go on the OPEN side: meme left of centre → notes right, and
            // vice-versa. Text hugs the meme's inner edge.
            const notesOnRight = cx < W / 2;
            const memeLeft = cx - w / 2;
            const memeRight = cx + w / 2;
            const noteX = notesOnRight ? memeRight + NOTE_GAP : EDGE;
            const noteW = notesOnRight
              ? Math.max(0, (W - EDGE) - (memeRight + NOTE_GAP))
              : Math.max(0, (memeLeft - NOTE_GAP) - EDGE);
            const noteAlign = notesOnRight ? "left" : "right";
            const showNotes =
              noteW > NOTE_MIN_W && (dateStr || desc || ev.day != null);

            return (
              <g key={ev.id || i} overflow="visible">
                <foreignObject
                  x={cx - w / 2}
                  y={cy - h / 2}
                  width={w}
                  height={h}
                  overflow="visible"
                >
                  <div
                    xmlns="http://www.w3.org/1999/xhtml"
                    ref={(el) => {
                      sentinelRefs.current[i] = el;
                      if (isAnchor) currentRef.current = el;
                    }}
                    data-idx={i}
                    style={{
                      position: "relative",
                      width: "100%",
                      height: "100%",
                      pointerEvents: "none",
                      lineHeight: 0,
                    }}
                  >
                    {memeImg && memeImg.length > 1 && (
                      <img
                        src={cloudinaryResize(memeImg, memeW * 2)}
                        alt=""
                        onLoad={handleImgLoad(key)}
                        style={{
                          display: "block",
                          width: "100%",
                          height: "auto",
                          border: "3px solid var(--red)",
                          boxSizing: "border-box",
                        }}
                      />
                    )}

                    {/* Caption — uniform size, laid over the image */}
                    {memeText && (
                      <div style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "6px 8px",
                        boxSizing: "border-box",
                      }}>
                        <div style={{
                          fontFamily: "Impact, system-ui, sans-serif",
                          fontWeight: 900,
                          textTransform: "uppercase",
                          textAlign: "center",
                          color: "#fff",
                          fontSize: captionFont,
                          lineHeight: 1,
                          letterSpacing: 0.3,
                          WebkitTextStroke: "0.5px var(--red)",
                          textShadow: "0 1px 3px rgba(0,0,0,0.75)",
                          display: "-webkit-box",
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}>
                          {memeText}
                        </div>
                      </div>
                    )}
                  </div>
                </foreignObject>

                {/* ── Meta notes — small white labels beside the meme ── */}
                {showNotes && (
                  <foreignObject
                    x={noteX}
                    y={cy - h / 2}
                    width={noteW}
                    height={h}
                    overflow="visible"
                  >
                    <div
                      xmlns="http://www.w3.org/1999/xhtml"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        width: "100%",
                        alignItems: notesOnRight ? "flex-start" : "flex-end",
                        textAlign: noteAlign,
                        color: "#fff",
                        fontFamily: "system-ui, sans-serif",
                        pointerEvents: "none",
                      }}
                    >
                      {dateStr && (
                        <div style={{
                          fontSize: 9,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          opacity: 0.7,
                        }}>
                          {dateStr}
                        </div>
                      )}
                      {ev.day != null && (
                        <div style={{
                          fontSize: 9,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          fontWeight: 700,
                        }}>
                          Day {ev.day}
                        </div>
                      )}
                      {desc && (
                        <div style={{
                          fontSize: 10,
                          lineHeight: 1.25,
                          opacity: 0.85,
                          maxWidth: isMobile ? "100%" : DESC_MAX_W,
                          display: "-webkit-box",
                          WebkitLineClamp: 6,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}>
                          {desc}
                        </div>
                      )}
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}