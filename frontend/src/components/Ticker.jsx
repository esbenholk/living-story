import React from "react";

const ANIMATION = `
@keyframes ticker-x {
  from { transform: translateX(0); }
  to   { transform: translateX(50%); }
}
@keyframes ticker-y-up {
  from { transform: translateY(0); }
  to   { transform: translateY(-50%); }
}
@keyframes ticker-y-down {
  from { transform: translateY(-50%); }
  to   { transform: translateY(0); }
}
`;

export default function Ticker({
  text,
  position = "top",
  speed = 100,
  color = "var(--red)",
  borderColor = "var(--red)",
  opacity = 1,
}) {
  const isTop = position === "top";
  const isLeft = position === "left";
  const isRight = position === "right";

  const single = `${text} · `.repeat(30);

  const containerStyle = {
    position: "absolute",
    zIndex: 10,
    overflow: "hidden",
    pointerEvents: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--blue)",
    borderColor,
    borderStyle: "solid",
    borderWidth: "var(--borderwidth)",
    transition: "border-color 0.3s, color 0.3s",
    ...(isTop && {
      top: 0,
      left: 0,
      right: 0,
      height: 40,
      flexDirection: "row",
    }),
    ...(isLeft && {
      left: 0,
      top: 0,
      bottom: 0,
      width: 40,
      flexDirection: "column",
      // no rotate — writingMode handles reading direction
    }),
    ...(isRight && {
      right: 0,
      top: 0,
      bottom: 0,
      width: 40,
      flexDirection: "column",
    }),
  };

  const wrapperStyle = {
    display: "flex",
    flexDirection: isTop ? "row" : "column",
    animation: isTop
      ? `ticker-x     ${speed}s linear infinite`
      : isLeft
        ? `ticker-y-up  ${speed}s linear infinite`
        : `ticker-y-down ${speed}s linear infinite`,
    willChange: "transform",
  };

  const segmentStyle = {
    whiteSpace: "nowrap",
    fontSize: 30,
    letterSpacing: 2,

    color,
    opacity,
    transition: "color 0.3s",
    ...(!isTop && { writingMode: "vertical-rl" }),
    // Left ticker: rotate text 180° so reading direction faces screen centre
    // (bottom-to-top reading). The container and animation are untouched.
    ...(isLeft && { transform: "rotate(180deg)" }),
  };

  return (
    <>
      <style>{ANIMATION}</style>
      <div style={containerStyle} className="ticker">
        <div style={wrapperStyle}>
          <span style={segmentStyle}>{single}</span>
          <span style={segmentStyle}>{single}</span>
        </div>
      </div>
    </>
  );
}
