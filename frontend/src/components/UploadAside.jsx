import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { uploadImage } from "../api/upload.js";
import { useFaceCrops } from "../hooks/useFaceCrops.js";
import Ticker from "./Ticker.jsx";
import { HERO_TAGS, defaultTagForDay } from "../config/heroTags.js";

const DONE_DURATION = 50000;
const MOBILE_BREAKPOINT = 600;
const MIN_MOBILE_UPLOADER_HEIGHT = 72;

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
@keyframes text-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
`;

function FrameSVG({ phase }) {
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
  const S = 5;
  const x = S / 2, y = S / 2;
  const rw = w - S, rh = h - S;
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

export default function UploadAside({
  currentDay,
  currentConfig,
  onGoToStory,
  servicesReady,
  servicesChecking,
  serviceStatus,
  defaultHeroTagId,
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("idle");
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState("");
  const [selectedTag, setSelectedTag] = useState(
    defaultHeroTagId
      ? (HERO_TAGS.find((t) => t.id === defaultHeroTagId) ?? null)
      : null,
  );
  const [userHasChosen, setUserHasChosen] = useState(!!defaultHeroTagId);

  const inputRef = useRef();
  const doneTimer = useRef(null);

  const layoutRef = useRef(null);
  const headlineRef = useRef(null);
  const mainUploaderRef = useRef(null);
  const tagGridRef = useRef(null);
  const actionsRef = useRef(null);

  const [responsiveLayout, setResponsiveLayout] = useState({
    isMobile:
      typeof window !== "undefined"
        ? window.innerWidth < MOBILE_BREAKPOINT
        : false,
    uploaderHeight: null,
  });

  const isMobile = responsiveLayout.isMobile;
  const mobileUploaderHeight = responsiveLayout.uploaderHeight;

  useLayoutEffect(() => {
    const layoutEl = layoutRef.current;
    if (!layoutEl || typeof window === "undefined") return;

    let rafId = null;

    const measure = () => {
      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        const nextIsMobile = window.innerWidth < MOBILE_BREAKPOINT;

        if (!nextIsMobile) {
          setResponsiveLayout((prev) =>
            prev.isMobile || prev.uploaderHeight !== null
              ? { isMobile: false, uploaderHeight: null }
              : prev,
          );
          return;
        }

        const layoutStyles = window.getComputedStyle(layoutEl);

        const paddingTop = parseFloat(layoutStyles.paddingTop) || 0;
        const paddingRight = parseFloat(layoutStyles.paddingRight) || 0;
        const paddingBottom = parseFloat(layoutStyles.paddingBottom) || 0;
        const paddingLeft = parseFloat(layoutStyles.paddingLeft) || 0;

        const availableHeight =
          layoutEl.clientHeight - paddingTop - paddingBottom;

        const availableWidth =
          layoutEl.clientWidth - paddingLeft - paddingRight;

        const headlineHeight = headlineRef.current?.offsetHeight ?? 0;
        const tagGridHeight = tagGridRef.current?.offsetHeight ?? 0;
        const actionsHeight = actionsRef.current?.offsetHeight ?? 0;

        const mainUploaderStyles = mainUploaderRef.current
          ? window.getComputedStyle(mainUploaderRef.current)
          : null;

        const mainUploaderGap = mainUploaderStyles
          ? parseFloat(mainUploaderStyles.rowGap || mainUploaderStyles.gap) || 0
          : 0;

        const squareHeight = availableWidth;

        const maxUploaderHeight =
          availableHeight -
          headlineHeight -
          tagGridHeight -
          actionsHeight -
          mainUploaderGap;

        const nextUploaderHeight = Math.max(
          MIN_MOBILE_UPLOADER_HEIGHT,
          Math.min(squareHeight, Math.floor(maxUploaderHeight)),
        );

        setResponsiveLayout((prev) => {
          const heightChanged =
            Math.abs((prev.uploaderHeight ?? 0) - nextUploaderHeight) > 1;

          if (prev.isMobile === nextIsMobile && !heightChanged) return prev;

          return {
            isMobile: nextIsMobile,
            uploaderHeight: nextUploaderHeight,
          };
        });
      });
    };

    const resizeObserver = new ResizeObserver(measure);

    [layoutEl, headlineRef.current, tagGridRef.current, actionsRef.current].forEach(
      (el) => {
        if (el) resizeObserver.observe(el);
      },
    );

    measure();

    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [currentConfig?.headline, servicesReady, servicesChecking, status]);

  const uploaderBoxMobileSizing = isMobile
    ? {
        height: mobileUploaderHeight ? `${mobileUploaderHeight}px` : undefined,
        maxHeight: mobileUploaderHeight
          ? `${mobileUploaderHeight}px`
          : undefined,
        aspectRatio: mobileUploaderHeight ? "auto" : "1 / 1",
      }
    : {
        height: "100%",
        maxHeight: "100%",
        aspectRatio: "auto",
      };

  useEffect(() => {
    if (currentDay && !userHasChosen) {
      setSelectedTag(defaultTagForDay(currentDay));
    } else if (defaultHeroTagId) {
      setSelectedTag(HERO_TAGS.find((t) => t.id === defaultHeroTagId) ?? null);
    }
  }, [currentDay, userHasChosen, defaultHeroTagId]);

  useEffect(() => () => clearTimeout(doneTimer.current), []);

  const { extractCrops } = useFaceCrops();

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStatus("idle");
    setProgress(0);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setProgress(0);
    setStatus("idle");
    setUserHasChosen(false);
    if (currentDay) setSelectedTag(defaultTagForDay(currentDay));
  }

  async function handleSubmit() {
    if (
      !file ||
      !selectedTag ||
      status === "uploading" ||
      status === "analysing"
    ) {
      return;
    }

    setStatus("analysing");

    let faceCrops = null;

    try {
      faceCrops = await extractCrops(file);
    } catch (err) {
      console.warn("[UploadAside] Face crop extraction failed:", err);
    }

    setStatus("uploading");

    try {
      await uploadImage(
        { file, uploaderName: name, faceCrops, heroTagId: selectedTag.id },
        setProgress,
      );
      setStatus("done");
      doneTimer.current = setTimeout(reset, DONE_DURATION);
    } catch {
      setStatus("error");
    }
  }

  const busy = status === "analysing" || status === "uploading";
  const isDone = status === "done";
  const isUploading = status === "uploading" || status === "analysing";
  const canSubmit = file && selectedTag && !busy && !isDone && servicesReady;

  const tickerText = isUploading
    ? {
        top: "uploading memory to plot · ",
        left: "uploading memory to plot · ",
        right: "uploading memory to plot · ",
      }
    : isDone
      ? {
          top: "memory received · stand by · ",
          left: "the machine is processing · ",
          right:
            parseInt(currentDay) > 4
              ? "watch the screen · "
              : "read the saga · ",
        }
      : {
          top: SLIDE_TICKERS[0].top,
          left: SLIDE_TICKERS[0].left,
          right: SLIDE_TICKERS[0].right,
        };

  const tickerColor = isDone ? "var(--highlight)" : "var(--red)";
  const tickerBorderColor = isDone ? "var(--highlight)" : "var(--red)";

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
      <FrameSVG phase={isUploading ? "uploading" : isDone ? "done" : "idle"} />

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
        color="white"
        borderColor={tickerBorderColor}
      />

      <div
        ref={layoutRef}
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          padding: "50px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <h1
          ref={headlineRef}
          style={{
            minHeight: isMobile ? "100px" : "none",
            margin: 0,
          }}
        >
          {currentConfig?.headline}
        </h1>

        <div
          id="mainUploader"
          ref={mainUploaderRef}
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            flexGrow: isMobile ? 0 : 1,
            minHeight: 0,
            gap: isMobile ? 20 : 24,
            alignItems: "stretch",
            justifyContent: "space-between",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: isMobile ? "100%" : "50%",
              flex: isMobile ? "0 0 auto" : "0 0 50%",
              minHeight: 0,
              display: "flex",
            }}
          >
            {!servicesReady ? (
              <div
                style={{
                  width: "100%",
                  ...uploaderBoxMobileSizing,
                  border: `2px solid var(--red)`,
                  borderRadius: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundImage: "url('placeholder.gif')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {servicesChecking ? (
                  "Checking services..."
                ) : (
                  <div
                    style={{
                      backgroundColor: "var(--blue)",
                      margin: "var(--borderwidth)",
                      padding: "var(--borderwidth)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignContent: "center",
                      alignItems: "center",
                      textAlign: "center",
                    }}
                  >
                    <p>excuse the inconvenience:</p>
                    <p>slop plot temporarily down</p>
                    <p>{!serviceStatus.sidecar && "· Sidecar offline ·"}</p>
                    <p>{!serviceStatus.ollama && "· Ollama offline ·"}</p>
                    <p>Services unavailable</p>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="uploaderImage"
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
                  ...uploaderBoxMobileSizing,
                  border: `${
                    dragging
                      ? "2px dashed var(--red)"
                      : isDone
                        ? "2px solid var(--highlight)"
                        : preview
                          ? "2px solid var(--highlight)"
                          : "2px solid var(--red)"
                  }`,
                  borderRadius: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: busy || isDone ? "default" : "pointer",
                  transition: "border-color 0.2s",
                  backgroundImage:
                    preview || isDone ? "none" : "url('placeholder.gif')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {isDone ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: 28,
                      gap: 20,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--highlight)",
                        letterSpacing: 3,
                        textTransform: "uppercase",
                        lineHeight: 2,
                      }}
                    >
                      thank you for your memory
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color: "white",
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        lineHeight: 2,
                        opacity: 0.6,
                        animation: "text-pulse 2.4s ease-in-out infinite",
                      }}
                    >
                      the slop plot machine
                      <br />
                      is processing it
                    </div>
                  </div>
                ) : preview ? (
                  <img
                    src={preview}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      animation: isUploading
                        ? "preview-pulse 2.6s ease-in-out infinite"
                        : "none",
                      transition: "opacity 0.3s",
                    }}
                    alt="preview"
                  />
                ) : (
                  <div style={{ textAlign: "center", padding: 20 }}>
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
                  // capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => handleFile(e.target.files[0])}
                />
              </div>
            )}
          </div>

          <div
            style={{
              width: isMobile ? "100%" : "50%",
              flex: isMobile ? "0 0 auto" : "1 1 50%",
              minHeight: 0,
              display: "flex",
            }}
          >
            <div
              ref={tagGridRef}
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "repeat(4, minmax(0, 1fr))"
                  : "repeat(2, minmax(0, 1fr))",
                gridAutoRows: isMobile ? "auto" : "minmax(0, 1fr)",
                gap: 6,
                width: "100%",
                height: isMobile ? "auto" : "100%",
                minHeight: 0,
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
                      width: "100%",
                      height: isMobile ? "auto" : "100%",
                      minHeight: 0,
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
                        maxHeight: "100%",
                        filter:
                          isSelected && userHasChosen
                            ? "brightness(0) saturate(100%) invert(76%) sepia(99%) saturate(600%) hue-rotate(60deg) brightness(100%)"
                            : isDefault && !userHasChosen
                              ? "brightness(0) saturate(100%) invert(76%) sepia(99%) saturate(600%) hue-rotate(60deg) brightness(100%)"
                              : "none",
                      }}
                    >
                      <img
                        src={`/tags/${tag.svg}`}
                        alt={tag.label}
                        style={{
                          display: "block",
                          width: isMobile ? 50 : "100%",
                          height: isMobile ? 50 : "100%",
                          maxWidth: isMobile ? 50 : "100%",
                          maxHeight: isMobile ? 50 : "100%",
                          objectFit: "contain",
                        }}
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
                        {tag.id}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {isDone ? (
          <div ref={actionsRef}>
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
                position: isMobile ? "relative" : "absolute",
                bottom: isMobile ? "auto" : 45,
                animation: "frame-flash 0.6s ease-in-out infinite",
              }}
            >
              Read the Saga →
            </button>
          </div>
        ) : (
          <div ref={actionsRef}>
            <p
              style={{
                fontFamily: "system-ui",
                fontSize: 10,
              }}
            >
              ****this is a participatory software artwork that runs on images.
              Share only images you have the right to use. By submitting them,
              you agree that they may become part of a public artwork shown at
              Roskilde Festival and online.
            </p>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                marginTop: 14,
                padding: "14px 2px",
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
                fontSize: !selectedTag ? 10 : 15,
                fontWeight: 400,
                letterSpacing: 3,
                textTransform: "uppercase",
                cursor: canSubmit ? "pointer" : "not-allowed",
                width: "100%",
                transition: "0.2s",
                position: "relative",
              }}
            >
              {!selectedTag ? "pick a tag to continue" : buttonLabel}
            </button>
          </div>
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
      </div>

      <style>{`
        ${FRAME_CSS}

        @keyframes tag-pulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1;   }
        }

        @keyframes text-pulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}