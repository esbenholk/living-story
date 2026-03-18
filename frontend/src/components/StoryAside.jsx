import React, { useEffect, useRef } from "react";

export default function StoryAside({ chapters, currentDay, isActive }) {
  const currentRef = useRef();

  // Only scroll to current day when this slide becomes active (user swipes to it)
  useEffect(() => {
    if (isActive && currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      console.log("story is active");
    }
  }, [isActive]);

  if (!chapters.length) {
    return (
      <div
        style={{
          height: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui",
          color: "#333",
          fontSize: 14,
          textAlign: "center",
          padding: 32,
          background: "var(--blue)",
        }}
      >
        The story begins when the first image arrives.
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100dvh",
        overflowY: "auto",
        padding: "32px 22px 80px",
        fontFamily: "Georgia, serif",
        color: "#e5e5e5",
        background: "var(--blue)",
        lineHeight: 1.8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 3,
          color: "var(--red)",
          textTransform: "uppercase",
          fontFamily: "system-ui",
          marginBottom: 36,
        }}
      >
        The Story
      </div>

      {chapters.map((chapter, i) => (
        <div
          key={chapter.id || i}
          id={`story-day-${chapter.day}`}
          ref={chapter.day === currentDay ? currentRef : null}
          style={{ marginBottom: 52 }}
        >
          <div
            style={{
              fontSize: 10,
              color: "var(--red)",
              letterSpacing: 2,
              fontFamily: "system-ui",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Day {chapter.day}
            {chapter.day === currentDay ? " · Today" : ""}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#fff",
              fontFamily: "system-ui",
              marginBottom: 16,
            }}
          >
            {chapter.headline}
          </div>
          <p style={{ fontSize: 16, color: "#bbb", margin: 0 }}>
            {chapter.text || "…"}
          </p>
        </div>
      ))}
    </div>
  );
}
