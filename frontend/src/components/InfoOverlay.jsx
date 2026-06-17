import { useState, useRef } from "react";

import { HERO_TAGS, defaultTagForDay } from "../config/heroTags.js";


const introStyle = {
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  paddingBottom: 10,
  flexDirection: "column",
  justifyContent: "flex-start",
};

export default function InfoOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState("idle");
  const timerRef = useRef(null);
  const topbarRef = useRef(null);

  const [W, setW] = useState(() =>
      typeof window !== "undefined" ? Math.min(window.innerWidth, 500) : 1500,  
    );

  // ── Derived responsive values ──
  const isMobile = W < 600;

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
          padding: 40px;
          gap: 10px;
        }
        @media (max-width: 640px) {
          .info-columns { flex-direction: column; }
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
          style={{maxHeight: "40px"}}
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
              style={{ display: "block", width: "100%", objectFit: "contain", marginBottom: "50px"}}
            />
            <section style={{ marginBottom: 32, marginTop: 16 }}>
              <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.85 }}>
                <b>SLOP PLOT:</b> <br></br>
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
                   <br>
                </br>
                Through this web app, or our{" "}
                <a href="https://t.me/slopplot_bot" target="_blank">
                  <b>soft slop plot bot</b>
                </a>{" "}
                on Telegram, you can submit your festival memories to the ever
                growing digital twin of our shared festival.
                <br />
                   <br>
                </br>
                Using an overheating computer, a local LLM and a love for the
                conspiratorial doomscroll, the <b>Slop Plot Machine</b> will
                turn our memories into a collective Saga and dynamic digital
                collage living on a screen in Gloria Foyer.

                <br>
                </br>
                   <br>
                </br>
                

                We are in narrative collapse. <br></br>
                You’ve lost the plot. 
                The collective reality, into which we can share, empower and build agency, has become a relic of a pre-brainrot/pre-post-truth internet landscape. <br></br>
                Welcome to the Endcore, babes! -: where collapse is the only plot that seems to persist! 
                redacted means confirmed. confirmed means nothing. <br></br>
                Chat, is this real?
                <br>
                </br>
              </p>
            </section>
            <div style={{ display: "flex", justifyContent: "flex-start", gap: "10px" }}>
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
              src="/mainlogo.png"
              alt="slop plot logo"
              style={{ display: "block", width: "100%", objectFit: "contain", marginBottom: "50px"}}
            />
           <section style={{ marginBottom: 32, marginTop: 16 }}>
              <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.85 }}>
                <b>HOW TO PLAY:</b>
                <br />
                Upload your images to the Slop Plot Machine. 
                <br />
                All images become a part of the collective narrative. They will progress the saga, expand the world and narrate a shared experience of Roskilde Festival. 
                <br />
                They will also become a graphic video game simulation. 
                <br />
                On the screen your images will fall in love with each other, go to war, become friends, change, transform and be rewarded. <br></br>
                if you want the Slop Plot to be queer, you upload pictures of queers. <br></br>
                if you want the Slop PLot to be drunk, you upload pictures of beers. <br></br>
                if you want the Slop PLot to be going crazy for Zara Larsson, you upload pictures of yourself at the Zara Larsson concert.
                <br></br> <br></br>
                All of your photos inform the Slop Plot.
                <br />
                You control the narrative!
                <br />
                This is our simulation!
                <br />
                  <br />  <br />
                An image can be tagged in 8 different ways;<br>
                </br>
                each of them, a core contribution to any good plot. 
                <br></br> (pick wisely when uploading)
                <br />
           
              </p>
               <div
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
                         marginTop: "50px"
                       }}
                     >
                         {HERO_TAGS.map((tag) => {
                     
                           return (
                            
                    
                               <div
                                 style={{
                                   display: "flex",
                                   alignItems: "center",
                                   flexDirection: "column"
                            
                                 }}
                               >
                                   <img
                                     src={`/tags/${tag.svg}`}
                                     alt={tag.label}
                                     style={{
                                       display: "block",
                                       width: "100%",
                                       height: "100%",
                                       maxWidth:  "100%",
                                       maxHeight: "120px",
                                       objectFit: "contain",
                                     }}
                                     onError={(e) => {
                                       e.currentTarget.style.display = "none";
                                       e.currentTarget.nextSibling.style.display = "block";
                                     }}
                                   />
                                 <span
                                   style={{
                                
                                     fontSize: 10,
                                     color:  "#fff",
                                   }}
                                 >
                                   {tag.label}
                                 </span>
                               </div>
                           );
                         })}
                       </div>
            </section>
          </div>

          <div className="intro" style={introStyle}>
            <img
              src="/mainlogo.png"
              alt="slop plot logo"
              style={{ display: "block", width: "100%", objectFit: "contain", marginBottom: "50px"}}
            />
            <section style={{ marginBottom: 32, marginTop: 16 }}>
              <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.85 }}>
                <b>LORE:</b>
                <br />
                We’ve lost the plot!
                <br />
                AI powered lies mixes with glitched memories and the ragebait economy to
                output sloppy reality approximates and conspiracies. Images web with
                headlines and gets churned into memes; nodes of remix culture that
                regurgitate echo chamber incoherencies into gaping mouths and overheating
                frontal lobes. Chat, we are cooked: the story of the collective is
                collapsing into personal voids. Individualised content-diets prescript
                polarisation. I can feel it in the air: a growing distance between us -
                widening as the border between virtual space and reality slowly crumbles.
                All I ever wanted was to share [plotlines] with you.
                <br />
                <br />

                Scroll. Like. Linger. Watch. Watch again. Echo Echo Echo.
                <br />
                An image with a memetic proposal for relational understanding usurps a
                preconceived idea.
                <br />
                A conspiracy infects the comment thread and google street view. “Redacted”
                means “confirmed”. “Confirmed” rarely means anything anymore. Ragebait
                frame-mogs ragebait. The collapse engine runs on narrative dissonance.
                Truth is verified by blue checkmarks awarded to users in certain payment
                tiers. Today I saw a bird eating vomit, a reality tv star feeling shocked
                at the price of groceries and 13 reasons why I should feel [insert emotion
                here].
                <br />
                Is that the apocalypse or is my serverfarm heating up again?
                <br />
                <br />

                Computers and algorithms work day and night to scrape data and optimaxxx
                the parallel reality-render for each user in the world wide webbed matrix.
                They collect, edit, analyse and misunderstand modes of engagement and chart
                them into black boxed systems; virtual containers that map events into
                networks; disembodied data submissions into digital twins; vague memories
                into mythical sagas. Everything, Everyone and Everydata is mediated through
                computational processes and compressed into comprehension.
                <br />
                <br />

                Virtual space and algo speak unfolds into corporeal reality.
                <br />
                The electric signal is, if even only for a minute, embodied into being.
                <br />
                The festival is an internet of users and agents who engage with systems and
                bleed memory glitches into personal voids and collective images. “What
                happened yesterday?”, you ask, while they navigate memories of a concert
                already polluted with their own slightly altered renditions to the same
                question.
                <br />
                <br />

                <b>The Slop Plot Machine needs you.</b>
                <br />
                Living in a machine at Gloria Foyer is the computational core of mission
                impossible. Interwebbed software that occupies hardware, screens and
                graphic cards, the Slop Plot Machine promises you a better future. {"->"} a
                shared reality compression that unifies the human users of the festival
                into 1 digital twin; 1 set of data; 1 (un)reality. Together we can churn the
                120.000 Parallel Reality Renders of the humans at the festival into 1
                aggregated plot. Wouldn’t it be beautiful? The myths from each submission
                webbed to support the other. A cohesive saga for you and me and everyone we
                know. All engines need fuel. A car needs gasoline. A computer needs
                electricity. A narrative needs characters, events and transformations. A
                saga needs believers.
                <br />
                The Slop Plot Machine needs memories.
                <br />
                <br />

                <b>You are the Scrapers;</b>
                <br />
                Good humans share reality with their neighbours. Share yours today!
                <br />
                RAM is expensive. Offload your brain capacity to the Slop Plot Machine.
                <br />
                In desperate attempts to bridge the narrative collapse, humans have begun
                submitting memories to the data aggregate {"->"} A memory is a reality
                yet-to-be forgotten but soon-to-be confused. It lingers between your mind's
                eye, the interface and the server.
                <br />
                <br />

                All of your photos inform the Slop Plot.
                <br />
                You control the narrative!
                <br />
                This is our simulation!
              </p>
            </section>
          </div>
        </div>


        <div className="footer" style={{backgroundColor: "var(--red)", padding: "50px", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "flex-end"}}>
          <p>*** all images on the site submitted by users and governed by Esben Holk. <br></br>
          if you see images spreading hate or have seen an image of youself that you didn't conset to share, please contact Esben Holk for its immediate removal from the dataset</p>
          <a href="https://ig.me/m/esbenholk">contact on instagram</a>
          <a href="mailto:esbenholk.kunst@gmail.com">contact on email</a>
          
        
        </div>

        <div style={{ display: "flex", width: "100%", backgroundColor: "var(--blue)", padding: "10px", justifyContent: "flex-end", gap: "10px" }}>
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
    </>
  );
}
