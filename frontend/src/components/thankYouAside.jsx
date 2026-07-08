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
        <h1>THE SLOP PLOT WAS A GENERATIVE SOFTWARE ARTWORK & SAGA GENERATOR FOR ROSKILDE FESTIVAL 2026. THE FESTIVAL IS OVER BUT THE SAGA PERSISTS</h1>
      </div>

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