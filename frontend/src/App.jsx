import React, { useState, useRef, useCallback } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "./Index.css";
import UploadAside from "./components/UploadAside.jsx";
import TimelineAside from "./components/TimelineAside.jsx";
import StoryAside from "./components/StoryAside.jsx";
import { useStory } from "./hooks/useStory.js";
import { useSocket } from "./hooks/useSocket.js";

const panelLabels = ["SUBMIT", "THE PLOT", "THE SAGA"];

export default function App() {
  const { events, chapters, currentDay, currentConfig, addEvent } = useStory();
  useSocket(addEvent);

  const [activeIndex, setActiveIndex] = useState(0);
  const swiperRef = useRef(null);

  // function goToSlide(index) {
  //   if (swiperRef.current) {
  //     swiperRef.current.slideTo(index);
  //   }
  // }

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
