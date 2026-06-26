import React from "react";

const ANIMATION = `
@keyframes ticker-x {
  from { transform: translateX(0); }
  to   { transform: translateX(50%); }
}
@keyframes ticker-x-reverse {
  from { transform: translateX(50%); }
  to   { transform: translateX(0); }
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
  reverse = false,
}) {
  const isTop = position === "top";
  const isBottom = position === "bottom";
  const isLeft = position === "left";
  const isRight = position === "right";

  const isHorizontal = isTop || isBottom;

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
    ...(isHorizontal && {
      left: 0,
      right: 0,
      height: 40,
      flexDirection: "row",
      ...(isTop ? { top: 0 } : { bottom: 0 }),
    }),
    ...(isLeft && {
      left: 0,
      top: 0,
      bottom: 0,
      width: 40,
      flexDirection: "column",
    }),
    ...(isRight && {
      right: 0,
      top: 0,
      bottom: 0,
      width: 40,
      flexDirection: "column",
    }),
  };

  // Horizontal default scrolls one way; `reverse` flips it.
  // Handy if you want the bottom ticker travelling opposite the top one.
  const horizontalAnim = reverse ? "ticker-x-reverse" : "ticker-x";

  const wrapperStyle = {
    display: "flex",
    flexDirection: isHorizontal ? "row" : "column",
    animation: isHorizontal
      ? `${horizontalAnim} ${speed}s linear infinite`
      : isLeft
        ? `ticker-y-up   ${speed}s linear infinite`
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
    ...(!isHorizontal && { writingMode: "vertical-rl" }),
    // Left ticker: rotate 180° so reading direction faces screen centre.
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
