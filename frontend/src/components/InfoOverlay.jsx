import { useState, useRef } from "react";

const introStyle = {
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  paddingBottom: 10,
  flexDirection: "column",
  justifyContent: "space-between",
};

export default function InfoOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState("idle");
  const timerRef = useRef(null);
  const topbarRef = useRef(null);

  const open = () => {
    clearTimeout(timerRef.current);
    // restore topbar styles in case they were directly mutated
    topbarRef.current.style.cssText = "";
    setPhase("entering");
    setIsOpen(true);
    timerRef.current = setTimeout(() => setPhase("open"), 560);
  };

  const close = () => {
    clearTimeout(timerRef.current);
    setPhase("exiting");
    timerRef.current = setTimeout(() => {
      setIsOpen(false);
      setPhase("idle");
    }, 360);
  };

  const panelVisible = isOpen || phase === "exiting";

  return (
    <>
      <style>{`
        @keyframes slideDownBounce {
          0%   { transform: translateY(-100%); }
          60%  { transform: translateY(6px); }
          80%  { transform: translateY(-4px); }
          100% { transform: translateY(0); }
        }
        @keyframes slideUp {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-100%); }
        }
        @keyframes barExpand {
          0%   { width: 120px; }
          100% { width: 100%; }
        }

        .info-topbar {
          position: fixed;
          top: 0; right: 0;
          height: 40px;
          z-index: 300;
          background: var(--red);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          width: 120px;
        }
        .info-topbar.entering {
          justify-content: flex-start;
          animation: barExpand 0.55s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        .info-topbar.open {
          width: 100%;
          justify-content: flex-start;
        }
        .info-topbar.exiting {
          width: 100%;
          justify-content: flex-start;
          animation: slideUp 0.1s cubic-bezier(0.4,0,1,1) forwards;
        }

        .info-topbar button {
          flex-shrink: 0;
          height: 40px;
          padding: 0 16px;
          background: white;
          border: var(--borderwidth) solid var(--red);
          color: var(--red);
          font-family: system-ui;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
        }

        .info-columns {
          display: flex;
          flex-direction: row;
          padding: 10px;
          gap: 10px;
        }
        @media (max-width: 640px) {
          .info-columns { flex-direction: column; }
          .info-columns .intro { min-height: 100dvh; }
        }
      `}</style>

      <div
        ref={topbarRef}
        className={`info-topbar ${phase}`}
        onAnimationEnd={() => {
          if (phase === "exiting") {
            // bar just slid off screen — reset it silently under the panel
            const el = topbarRef.current;
            el.style.zIndex = "150";
            el.style.animation = "none";
            el.style.width = "120px";
            el.style.justifyContent = "flex-end";
            el.style.transform = "translateY(0)";
          }
        }}
      >
        <button
          onClick={
            phase === "idle" ? open : phase === "open" ? close : undefined
          }
        >
          {phase === "idle" || phase === "exiting" ? "INFO" : "CLOSE"}
        </button>
      </div>

      <div
        onAnimationEnd={() => {
          if (phase === "exiting") {
            // panel just finished sliding out — reveal the reset button
            topbarRef.current.style.zIndex = "300";
          }
        }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "var(--blue)",
          color: "white",
          overflowY: "auto",
          zIndex: 200,
          boxSizing: "border-box",
          fontFamily: "system-ui",
          paddingTop: 40,
          visibility: panelVisible ? "visible" : "hidden",
          pointerEvents: isOpen ? "auto" : "none",
          animation:
            phase === "entering"
              ? "slideDownBounce 0.55s cubic-bezier(0.22,1,0.36,1) forwards"
              : phase === "exiting"
                ? "slideUp 0.18s cubic-bezier(0.4,0,1,1) forwards"
                : "none",
        }}
      >
        <div className="info-columns">
          <div className="intro" style={introStyle}>
            <img
              src="/mainlogo.png"
              alt="slop plot logo"
              height={100}
              style={{ display: "block", width: "100%" }}
            />
            <section style={{ marginBottom: 32, marginTop: 16 }}>
              <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.85 }}>
                <b>SLOP PLOT</b> is a participatory art work presented at{" "}
                <a
                  href="https://www.roskilde-festival.dk/program/kunst-aktivisme/esben-holk"
                  target="_blank"
                >
                  <b>Roskilde Festival 2026</b>
                </a>{" "}
                by software artist{" "}
                <a href="https://www.instagram.com/esbenholk/" target="_blank">
                  <b>Esben Holk</b>
                </a>
                .<br />
                Through this web app, or our{" "}
                <a href="https://t.me/slopplot_bot" target="_blank">
                  <b>soft slop plot bot</b>
                </a>{" "}
                on Telegram, you can submit your festival memories to the ever
                growing digital twin of our shared festival.
                <br />
                Using an overheating computer, a local LLM and a love for the
                conspiratorial doomscroll, the <b>Slop Plot Machine</b> will
                turn our memories into a collective Saga and dynamic digital
                collage living on a screen in Gloria Foyer.
              </p>
            </section>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <a href="https://t.me/slopplot_bot" target="_blank">
                <img
                  src="/telegram.png"
                  alt="telegram"
                  height={35}
                  style={{ display: "block" }}
                />
              </a>
              <a href="https://www.instagram.com/esbenholk/" target="_blank">
                <img
                  src="/instagram.png"
                  alt="instagram"
                  height={35}
                  style={{ display: "block" }}
                />
              </a>
              <a
                href="https://www.roskilde-festival.dk/program/kunst-aktivisme/esben-holk"
                target="_blank"
              >
                <img
                  src="/roskildefestival.png"
                  alt="roskilde festival"
                  height={35}
                  style={{ display: "block" }}
                />
              </a>
            </div>
          </div>

          <div className="intro" style={introStyle}>
            <img
              src="/playerlogo.png"
              alt="player logo"
              height={100}
              style={{ display: "block", width: "100%" }}
            />
            <section style={{ marginBottom: 32, marginTop: 16 }}>
              <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.85 }}>
                Your second column content here.
              </p>
            </section>
          </div>

          <div className="intro" style={introStyle}>
            <img
              src="/mainlogo.png"
              alt="slop plot logo"
              height={100}
              style={{ display: "block", width: "100%" }}
            />
            <section style={{ marginBottom: 32, marginTop: 16 }}>
              <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.85 }}>
                Your third column content here.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
