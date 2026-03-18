import React, { useState, useRef, useEffect } from "react";
import { uploadImage } from "../api/upload.js";
import { useFaceCrops } from "../hooks/useFaceCrops.js";
import Ticker from "./Ticker.jsx";
import { HERO_TAGS, defaultTagForDay } from "../config/heroTags.js";
import placeholderGif from "../assets/placeholder.gif";

// How long the "done" celebration state lasts before resetting (ms)
const DONE_DURATION = 50000;

const SLIDE_TICKERS = [
  {
    top: "U ALSO LOSING THE PLOT?",
    left: "SUBMIT (TO) THE PLOT",
    right: "SWIPE TO EXPLORE",
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

// ── Frame animation ────────────────────────────────────────────────────────
// A single SVG rectangle whose stroke-dashoffset animates to "draw" the frame
// starting from the bottom-left corner, going up → right → down → left.
// The perimeter is computed from the viewport at render time via a ResizeObserver.
// We drive it with a CSS custom property so we don't need JS animation frames.
const FRAME_CSS = `
@keyframes frame-draw {
  from { stroke-dashoffset: var(--perimeter); }
  to   { stroke-dashoffset: 0; }
}
@keyframes frame-flash {
  0%, 100% { stroke: var(--red); }
  50%       { stroke: var(--highlight); }
}
@keyframes preview-pulse {
  0%, 100% { opacity: 1;   }
  50%       { opacity: 0.3; }
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes ticker-flash {
  0%, 100% { color: var(--red); }
  50%       { color: var(--highlight); }
}
`;

function FrameSVG({ phase }) {
  // phase: "idle" | "uploading" | "done"
  const ref = useRef();
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current?.closest("[data-upload-aside]");
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (phase === "idle" || dims.w === 0) return null;

  const { w, h } = dims;
  const perimeter = 2 * (w + h);
  // Inset by half the stroke so it sits just inside the edge
  const S = 5; // stroke width
  const x = S / 2,
    y = S / 2;
  const rw = w - S,
    rh = h - S;

  // Start point: bottom-left corner. SVG rect path order:
  // top-left → top-right → bottom-right → bottom-left → top-left
  // We need bottom-left as origin. We rotate the dashoffset start by shifting
  // the starting point using a custom path that begins at bottom-left.
  // Path: M bottom-left → up to top-left → right to top-right → down to bottom-right → left back to bottom-left
  const d = `M ${x} ${y + rh} L ${x} ${y} L ${x + rw} ${y} L ${x + rw} ${y + rh} L ${x} ${y + rh}`;

  const isUploading = phase === "uploading";
  const isDone = phase === "done";

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 20,
        overflow: "visible",
      }}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <style>{FRAME_CSS}</style>
      <path
        ref={ref}
        d={d}
        fill="none"
        stroke={isDone ? "var(--highlight)" : "white"}
        strokeWidth={S}
        strokeLinecap="square"
        style={{
          "--perimeter": `${perimeter}px`,
          strokeDasharray: perimeter,
          strokeDashoffset: isUploading ? undefined : 0,
          animation: isUploading
            ? `frame-draw 2s linear forwards`
            : isDone
              ? `frame-flash 0.6s ease-in-out infinite`
              : "none",
        }}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function UploadAside({
  currentDay,
  currentConfig,
  onGoToStory,
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [cutoutUrl, setCutoutUrl] = useState(null); // shown after upload completes
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | analysing | uploading | done
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);
  const [userHasChosen, setUserHasChosen] = useState(false);
  const inputRef = useRef();
  const doneTimer = useRef(null);

  // Sync default tag once currentDay resolves
  useEffect(() => {
    if (currentDay && !userHasChosen)
      setSelectedTag(defaultTagForDay(currentDay));
  }, [currentDay, userHasChosen]);

  // Clean up done-state timer on unmount
  useEffect(() => () => clearTimeout(doneTimer.current), []);

  const { extractCrops } = useFaceCrops();

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setCutoutUrl(null);
    setStatus("idle");
    setProgress(0);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setCutoutUrl(null);
    setProgress(0);
    setStatus("idle");
    setUserHasChosen(false);
    // Re-apply day default
    if (currentDay) setSelectedTag(defaultTagForDay(currentDay));
  }

  async function handleSubmit() {
    if (
      !file ||
      !selectedTag ||
      status === "uploading" ||
      status === "analysing"
    )
      return;

    setStatus("analysing");
    let faceCrops = null;
    try {
      faceCrops = await extractCrops(file);
    } catch (err) {
      console.warn("[UploadAside] Face crop extraction failed:", err);
    }

    setStatus("uploading");
    try {
      const result = await uploadImage(
        { file, uploaderName: name, faceCrops, heroTagId: selectedTag.id },
        setProgress,
      );
      // Grab the subject cutout URL from the pipeline result if available

      console.log("has uploaded", result);

      const subject = result?.cutouts?.subject || null;
      setCutoutUrl(subject);
      setStatus("done");

      // Auto-reset after DONE_DURATION
      doneTimer.current = setTimeout(reset, DONE_DURATION);
    } catch {
      setStatus("error");
    }
  }

  const busy = status === "analysing" || status === "uploading";
  const isDone = status === "done";
  const isUploading = status === "uploading" || status === "analysing";
  const canSubmit = file && selectedTag && !busy && !isDone;

  // ── Ticker text & colour based on status ────────────────────────────────
  const tickerText = isUploading
    ? {
        top: "uploading memory to plot · ",
        left: "uploading memory to plot · ",
        right: "uploading memory to plot · ",
      }
    : isDone
      ? {
          top: "upload complete · memory added · ",
          left: "upload complete · memory added · ",
          right: "upload complete · memory added · ",
        }
      : {
          top: SLIDE_TICKERS[0].top,
          left: SLIDE_TICKERS[0].left,
          right: SLIDE_TICKERS[0].right,
        };

  const tickerColor = isDone ? "var(--highlight)" : "var(--red)";
  const tickerBorderColor = isDone ? "var(--highlight)" : "var(--red)";

  // ── Preview src — switch to cutout on done ───────────────────────────────
  const previewSrc = isDone && cutoutUrl ? cutoutUrl : preview;

  const buttonLabel = (() => {
    if (status === "analysing") return "Analysing...";
    if (status === "uploading") return `${progress}%`;
    if (isDone) return "Submitted to the plot";
    return "create the plot";
  })();

  return (
    <div
      data-upload-aside
      style={{
        position: "relative",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "45px 45px 60px",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        overflowY: "auto",
        gap: 0,
      }}
    >
      {/* ── Frame animation overlay ─────────────────────────────────── */}
      <FrameSVG phase={isUploading ? "uploading" : isDone ? "done" : "idle"} />

      {/* ── Tickers ─────────────────────────────────────────────────── */}

      <Ticker
        position="left"
        text={tickerText.left.replace("{day}", currentDay)}
        color={tickerColor}
        borderColor={tickerBorderColor}
      />
      <Ticker
        position="right"
        text={tickerText.right.replace("{day}", currentDay)}
        color={tickerColor}
        borderColor={tickerBorderColor}
      />
      <Ticker
        position="top"
        text={tickerText.top.replace("{day}", currentDay)}
        color={"white"}
        borderColor={tickerBorderColor}
      />

      {/* Headline */}
      <div>
        <h1>{currentConfig?.headline}</h1>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => !busy && !isDone && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy && !isDone) handleFile(e.dataTransfer.files[0]);
        }}
        style={{
          width: "100%",
          maxWidth: 320,
          aspectRatio: "1",
          border: `${dragging ? "2px dashed var(--red)" : previewSrc ? "2px solid var(--highlight)" : "2px solid var(--red)"}`,
          borderRadius: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: busy || isDone ? "default" : "pointer",
          transition: "border-color 0.2s",
          background:
            isDone && cutoutUrl
              ? "var(--red)"
              : isUploading
                ? `linear-gradient(to top, var(--red) ${progress}%, transparent ${progress}%)`
                : "none",
          backgroundImage: previewSrc
            ? "none"
            : "url('/src/assets/placeholder.gif')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {previewSrc ? (
          <img
            src={previewSrc}
            style={{
              width: "100%",
              height: "100%",
              objectFit: isDone && cutoutUrl ? "contain" : "cover",
              // Oscillate opacity while uploading
              animation: isUploading
                ? "preview-pulse 2.6s ease-in-out infinite"
                : "none",
              transition: "opacity 0.3s",
              background: isDone && cutoutUrl ? "transparent" : undefined,
            }}
            alt="preview"
          />
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: 20,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>📷</div>
            <div
              style={{
                fontSize: 13,
                color: "var(--highlight)",
                background: "rgba(0,0,0,1)",
                padding: "4px 12px",
              }}
            >
              Tap to submit a memory
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {/* ── Tag selector ─────────────────────────────────────────────── */}
      <div style={{ width: "100%", maxWidth: "calc(100%)", marginTop: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 6,
          }}
        >
          {HERO_TAGS.map((tag) => {
            const isSelected = selectedTag?.id === tag.id;
            const isDefault = tag.day === currentDay;
            return (
              <button
                key={tag.id}
                onClick={() => {
                  setSelectedTag(tag);
                  setUserHasChosen(true);
                }}
                title={tag.names}
                disabled={busy || isDone}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  background: "rgba(0,0,0,0)",
                  border: "0px solid rgba(0,0,0,0)",
                  borderRadius: 6,
                  cursor: busy || isDone ? "default" : "pointer",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
              >
                {isDefault && !isSelected && (
                  <div
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "var(--red)",
                    }}
                  />
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    filter:
                      isSelected && userHasChosen
                        ? "brightness(0) saturate(100%) invert(76%) sepia(99%) saturate(600%) hue-rotate(60deg) brightness(100%)"
                        : isDefault && !userHasChosen
                          ? "brightness(0) saturate(100%) invert(76%) sepia(99%) saturate(600%) hue-rotate(60deg) brightness(100%)"
                          : "none",
                  }}
                >
                  <img
                    src={`/src/assets/tags/${tag.svg}`}
                    alt={tag.label}
                    width={50}
                    height={50}
                    style={{ display: "block" }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextSibling.style.display = "block";
                    }}
                  />
                  <span
                    style={{
                      display: "none",
                      fontSize: 16,
                      color: isSelected ? "#fff" : "var(--red)",
                    }}
                  >
                    {tag.day}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Submit / Done buttons ────────────────────────────────────── */}
      {isDone ? (
        // Slide-to-story button — only shown during done phase
        <button
          onClick={() => {
            onGoToStory();
            reset();
          }}
          style={{
            marginTop: 14,
            padding: "14px 0",
            background: "var(--highlight)",
            color: "var(--blue)",
            border: "var(--borderwidth) solid var(--highlight)",
            borderRadius: 2,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: "uppercase",
            cursor: "pointer",
            width: "calc(100% - 90px)",
            maxWidth: 320,
            transition: "0.2s",
            position: "absolute",
            bottom: 45,
            animation: "frame-flash 0.6s ease-in-out infinite",
          }}
        >
          Read the story →
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            marginTop: 14,
            padding: "14px 0",
            background: isUploading
              ? `linear-gradient(to right, var(--highlight) ${progress}%, transparent ${progress}%)`
              : canSubmit
                ? "var(--highlight)"
                : "transparent",
            color: "var(--red)",
            border: canSubmit
              ? "var(--borderwidth) solid var(--red)"
              : "2px solid white",
            borderRadius: 2,
            fontSize: 15,
            fontWeight: 400,
            letterSpacing: 3,
            textTransform: "uppercase",
            cursor: canSubmit ? "pointer" : "not-allowed",
            width: "calc(100% - 90px)",
            maxWidth: 320,
            opacity: canSubmit ? 1 : 1,
            transition: "0.2s",
            position: "absolute",
            bottom: 45,
          }}
        >
          {!selectedTag ? "pick a tag to continue" : buttonLabel}
        </button>
      )}

      {status === "error" && (
        <p
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "var(--red)",
            position: "absolute",
            bottom: 100,
          }}
        >
          Something went wrong. Try again.
        </p>
      )}

      <style>{`
        ${FRAME_CSS}
        @keyframes tag-pulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
