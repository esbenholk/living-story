import React, { useState, useRef, useCallback, useEffect } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "./Index.css";
import UploadAside from "./components/UploadAside.jsx";
import TimelineAside from "./components/TimelineAside.jsx";
import StoryAside from "./components/StoryAside.jsx";
import { useStory } from "./hooks/useStory.js";
import { useSocket } from "./hooks/useSocket.js";
import InfoOverlay from "./components/InfoOverlay.jsx";

import Ticker from "./components/Ticker.jsx";

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

const panelLabels = ["SUBMIT", "THE FEED", "THE SAGA"];

const HEALTH_INTERVAL = 30_000;

function getTagFromUrl() {
  const path = window.location.pathname.replace("/", "").toLowerCase().trim();
  const param = new URLSearchParams(window.location.search)
    .get("tag")
    ?.toLowerCase()
    .trim();
  return param || path || null;
}

export default function App() {
  const {
    events,
    chapters,
    currentDay,
    currentConfig,
    addEvent,
    hasStarted,
    startDate,
  } = useStory();
  useSocket(addEvent);

  const [activeIndex, setActiveIndex] = useState(0);
  const swiperRef = useRef(null);

  // null = still checking, true = ok, false = down
  const [serviceStatus, setServiceStatus] = useState({
    sidecar: null,
    ollama: null,
  });

  const base = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const urlTag = getTagFromUrl();

  useEffect(() => {
    const run = async () => {
      const [sidecar, ollama] = await Promise.all([
        fetch(`${base}/api/health/sidecar`, {
          signal: AbortSignal.timeout(6000),
        })
          .then((r) => r.ok)
          .catch(() => false),
        fetch(`${base}/api/health/ollama`, {
          signal: AbortSignal.timeout(6000),
        })
          .then((r) => r.ok)
          .catch(() => false),
      ]);
      setServiceStatus({ sidecar, ollama });
    };

    run();
    const interval = setInterval(run, HEALTH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const servicesReady =
    serviceStatus.sidecar === true && serviceStatus.ollama === true;
  const servicesChecking =
    serviceStatus.sidecar === null || serviceStatus.ollama === null;

  console.log(
    "LOOKING 4 THE PLOT in THE INSPEXTOR???, makes sense but i dont think u'll find it here",
    events,
    chapters,
    currentConfig,
    servicesReady,
  );

  const goToSlide = useCallback((index) => {
    if (swiperRef.current) swiperRef.current.slideTo(index);
  }, []);

  return (
    <div
      style={{
        height: "100dvh",
        width: "100vw",
        background: "var(--blue)",
        position: "relative",
      }}
    >
      <InfoOverlay />

      {hasStarted === false && <PreLaunchOverlay startDate={startDate} />}

      <Swiper
        slidesPerView={1}
        style={{ height: "100%" }}
        initialSlide={0}
        onSwiper={(swiper) => (swiperRef.current = swiper)}
        onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
        observer={false}
        observeParents={false}
        resizeObserver={false}
      >
        <SwiperSlide>
          <UploadAside
            currentDay={currentDay}
            currentConfig={currentConfig}
            onGoToStory={() => goToSlide(2)}
            isActive={activeIndex === 0}
            servicesReady={servicesReady}
            servicesChecking={servicesChecking}
            serviceStatus={serviceStatus}
            defaultHeroTagId={urlTag}
          />
        </SwiperSlide>
        <SwiperSlide>
          <TimelineAside
            events={events}
            currentDay={currentDay}
            isActive={activeIndex === 1}
          />
        </SwiperSlide>
        <SwiperSlide>
          <StoryAside
            chapters={chapters}
            currentDay={currentDay}
            isActive={activeIndex === 2}
          />
        </SwiperSlide>
      </Swiper>

      <div
        style={{
          position: "fixed",
          gap: "var(--borderwidth)",
          height: "40px",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          zIndex: 100,
        }}
      >
        {panelLabels.map((label, index) => (
          <button
            key={label}
            onClick={() => goToSlide(index)}
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontFamily: "system-ui",
              background: "none",
              flexGrow: 1,
              cursor: "pointer",
              padding: "6px 12px",

              border: "var(--borderwidth) solid var(--red)",
              color: activeIndex === index ? "var(--red)" : "var(--red)",
              backgroundColor:
                activeIndex === index ? "var(--highlight)" : "var(--blue)",
              transition: "color 0.2s, background-color 0.2s",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function getRemaining(target) {
  const diff = Math.max(0, target - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
    done: diff === 0,
  };
}

const UNITS = [
  ["DAYS", "days"],
  ["HRS", "hours"],
];

const cell = {
  border: "var(--borderwidth) solid var(--red)",
  background: "var(--blue)",
  color: "var(--red)",
  padding: "12px 14px",
  minWidth: 64,
  fontFamily: "system-ui",
  fontVariantNumeric: "tabular-nums",
};

function PreLaunchOverlay({ startDate }) {
  const target = startDate ? new Date(startDate).getTime() : null;

  const [remaining, setRemaining] = useState(() =>
    target ? getRemaining(target) : null,
  );

  useEffect(() => {
    if (!target) return;
    setRemaining(getRemaining(target));
    const id = setInterval(() => setRemaining(getRemaining(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 199,
        background: "var(--red)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        textAlign: "center",
        padding: "60px",
      }}
    >
      <Ticker
        position="left"
        text={"the slop plot is getting ready for u"}
        color={"var(--highlight)"}
        borderColor={"var(--red)"}
      />

      <Ticker
        position="right"
        text={"the slop plot is getting ready for u"}
        color={"var(--highlight)"}
        borderColor={"var(--red)"}
      />

      <Ticker
        position="top"
        text={"the slop plot is getting ready for u"}
        color={"var(--highlight)"}
        borderColor={"var(--red)"}
      />
      <Ticker
        position="bottom"
        text={"the slop plot is getting ready for u"}
        color={"var(--highlight)"}
        borderColor={"var(--red)"}
      />
      <div
        style={{
          fontSize: 23,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: "var(--blue)",
        }}
      >
        THE SLOP PLOT BOT IS LIVE IN
      </div>

      {remaining && !remaining.done && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--borderwidth)",
          }}
        >
          {UNITS.map(([label, key]) => (
            <div key={key} style={cell}>
              <div style={{ fontSize: 30, lineHeight: 1 }}>
                {String(remaining[key]).padStart(2, "0")}
              </div>
              <div style={{ fontSize: 9, letterSpacing: 2, marginTop: 8 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {(!remaining || remaining.done) && (
        <div
          style={{
            fontFamily: "system-ui",
            fontSize: 13,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "var(--red)",
          }}
        >
          Stand by
        </div>
      )}

      <div
        style={{
          fontFamily: "system-ui",
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--blue)",
          opacity: 0.6,
          maxWidth: 320,
          lineHeight: 1.6,
        }}
      >
        SLOP PLOT isnt running yet! <br></br>thank u for coming thoooooooo
      </div>
    </div>
  );
}
