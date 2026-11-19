"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  AArrowDown,
  AArrowUp,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  MonitorUp,
  X,
} from "lucide-react";
import type { SongInput } from "@/types/song";
import {
  DEFAULT_SCALE_INDEX,
  TEXT_SCALES,
  deckSlides,
  fitFontSize,
  type Slide,
} from "@/lib/presenter";
import { stepIndex } from "@/lib/performance";

type Audience = { win: Window; root: HTMLElement };
type PresentedSong = Pick<SongInput, "title" | "artist" | "lyrics">;

const MIN_FONT_PX = 12;

// Styles for the projector window. The slide's font-size is set by auto-fit.
function audienceStyles(origin: string) {
  return `
@font-face { font-family: "Noto Sans"; src: url("${origin}/fonts/NotoSans-Regular.ttf") format("truetype"); font-weight: 400; }
@font-face { font-family: "Noto Sans"; src: url("${origin}/fonts/NotoSans-Bold.ttf") format("truetype"); font-weight: 600 900; }
html, body { margin: 0; height: 100%; background: #000; color: #fff; }
body { font-family: "Noto Sans", Arial, sans-serif; overflow: hidden; }
.audience { box-sizing: border-box; height: 100vh; padding: 5vh 6vw; display: flex; align-items: center; justify-content: center; text-align: center; }
.slide-face { max-width: 100%; }
.slide-face p { margin: 0; font-size: 1em; line-height: 1.35; font-weight: 600; overflow-wrap: anywhere; }
.slide-face.title p { font-size: calc(9em / 7); font-weight: 700; }
.slide-face.title p + p { margin-top: 0.3em; font-size: calc(5em / 7); font-weight: 400; opacity: 0.75; }
`;
}

function SlideFace({ slide }: { slide: Slide }) {
  return (
    <div className={slide.kind === "title" ? "slide-face title" : "slide-face"}>
      {slide.lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}

export function PresenterView({
  songs,
  skipped = [],
  onClose,
}: {
  songs: PresentedSong[];
  skipped?: string[];
  onClose: () => void;
}) {
  const slides = useMemo(() => deckSlides(songs), [songs]);
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const [index, setIndex] = useState(0);
  const [blank, setBlank] = useState(false);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [scaleIndex, setScaleIndex] = useState(DEFAULT_SCALE_INDEX);
  const scale = TEXT_SCALES[scaleIndex];
  const audienceRef = useRef<Audience | null>(null);
  audienceRef.current = audience;

  // Shared by the control dialog and the audience window's native listener.
  const handleKey = useRef<(event: KeyboardEvent | ReactKeyboardEvent) => void>(() => {});
  handleKey.current = (event) => {
    const last = slides.length - 1;
    if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ")
      setIndex((i) => Math.min(last, i + 1));
    else if (event.key === "ArrowLeft" || event.key === "PageUp")
      setIndex((i) => Math.max(0, i - 1));
    else if (event.key === "b" || event.key === "B") setBlank((b) => !b);
    else if (event.key === "-")
      setScaleIndex((i) => stepIndex(TEXT_SCALES.length, i, -1));
    else if (event.key === "+" || event.key === "=")
      setScaleIndex((i) => stepIndex(TEXT_SCALES.length, i, 1));
    else return;
    event.preventDefault();
  };

  // Open: modal and screen wake lock. Close undoes both and closes the projector window.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    let lock: WakeLockSentinel | null = null;
    let closed = false;
    const requestLock = () => {
      if (!("wakeLock" in navigator)) return;
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          if (closed) void sentinel.release().catch(() => {});
          else lock = sentinel;
        })
        .catch(() => {});
    };
    requestLock();
    // The browser drops the lock when the tab is hidden; take it again on return.
    const onVisibility = () => {
      if (document.visibilityState === "visible") requestLock();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release().catch(() => {});
      audienceRef.current?.win.close();
      element.close();
    };
  }, []);

  // Auto-fit: start from a window-based size times the chosen scale, then shrink
  // until the slide fits inside the padded audience box.
  const fit = useRef(() => {});
  fit.current = () => {
    if (!audience) return;
    const { win, root } = audience;
    const face = root.querySelector<HTMLElement>(".slide-face");
    if (!face) return;
    const box = win.getComputedStyle(root);
    const width = root.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight);
    const height = root.clientHeight - parseFloat(box.paddingTop) - parseFloat(box.paddingBottom);
    const start = Math.min(win.innerHeight * 0.07, win.innerWidth * 0.042) * scale;
    const size = fitFontSize(start, MIN_FONT_PX, (px) => {
      face.style.fontSize = `${px}px`;
      return face.scrollHeight <= height && face.scrollWidth <= width;
    });
    face.style.fontSize = `${size}px`;
  };
  useLayoutEffect(() => fit.current(), [audience, index, blank, scale, slides]);

  // Audience window: React events do not cross documents, so listen natively.
  useEffect(() => {
    if (!audience) return;
    const { win } = audience;
    const doc = win.document;
    const onKey = (event: KeyboardEvent) => handleKey.current(event);
    const onDoubleClick = () => {
      const change = doc.fullscreenElement
        ? doc.exitFullscreen()
        : doc.documentElement.requestFullscreen();
      change.catch(() => {});
    };
    const gone = () => setAudience(null);
    const refit = () => fit.current();
    let open = true;
    void doc.fonts?.ready.then(() => {
      if (open) refit();
    });
    win.addEventListener("resize", refit);
    win.addEventListener("keydown", onKey);
    win.addEventListener("dblclick", onDoubleClick);
    win.addEventListener("pagehide", gone);
    const check = window.setInterval(() => {
      if (win.closed) gone();
    }, 1000);
    return () => {
      open = false;
      win.removeEventListener("resize", refit);
      win.removeEventListener("keydown", onKey);
      win.removeEventListener("dblclick", onDoubleClick);
      win.removeEventListener("pagehide", gone);
      window.clearInterval(check);
    };
  }, [audience]);

  useEffect(() => {
    list.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);

  function openAudience() {
    if (audience && !audience.win.closed) {
      audience.win.focus();
      return;
    }
    const win = window.open("", "worshiply-audience", "popup,width=1280,height=720");
    if (!win) {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    const doc = win.document;
    doc.documentElement.lang = "en";
    doc.title = "Worshiply lyrics";
    const style = doc.createElement("style");
    style.textContent = audienceStyles(window.location.origin);
    doc.head.replaceChildren(style);
    const root = doc.createElement("div");
    root.className = "audience";
    doc.body.replaceChildren(root);
    setAudience({ win, root });
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDialogElement>) {
    // Space and Enter on a focused button press that button.
    if (event.target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter"))
      return;
    handleKey.current(event);
  }

  const slide = slides[index];
  const next = slides[index + 1];
  const audienceOpen = !!audience && !audience.win.closed;
  return (
    <dialog
      ref={dialog}
      className="presenter-dialog no-print"
      aria-label="Lyrics presenter"
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="presenter-controls">
        <button className="button" onClick={onClose}>
          <X size={18} /> Exit
        </button>
        <div className="presenter-group" role="group" aria-label="Slides">
          <button
            className="button"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            <ChevronLeft size={18} /> Previous
          </button>
          <span className="presenter-count" aria-live="polite">
            Slide {index + 1} of {slides.length}
          </span>
          <button
            className="button primary"
            disabled={index === slides.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            Next <ChevronRight size={18} />
          </button>
        </div>
        <div className="presenter-group" role="group" aria-label="Text size">
          <button
            className="icon-button"
            aria-label="Smaller text"
            disabled={scaleIndex === 0}
            onClick={() => setScaleIndex(stepIndex(TEXT_SCALES.length, scaleIndex, -1))}
          >
            <AArrowDown size={20} />
          </button>
          <span className="presenter-count" aria-live="polite">
            Text {Math.round(scale * 100)}%
          </span>
          <button
            className="icon-button"
            aria-label="Larger text"
            disabled={scaleIndex === TEXT_SCALES.length - 1}
            onClick={() => setScaleIndex(stepIndex(TEXT_SCALES.length, scaleIndex, 1))}
          >
            <AArrowUp size={20} />
          </button>
        </div>
        <button className="button" aria-pressed={blank} onClick={() => setBlank(!blank)}>
          <EyeOff size={18} /> {blank ? "Show lyrics" : "Blank"}
        </button>
        <button className="button" onClick={openAudience}>
          <MonitorUp size={18} /> {audienceOpen ? "Show audience window" : "Open audience window"}
        </button>
      </div>
      {blocked && (
        <p className="field-error presenter-message" role="alert">
          Your browser blocked the audience window. Allow pop-ups for this site, then try again.
        </p>
      )}
      {skipped.length > 0 && (
        <p className="presenter-message" role="status">
          Couldn&apos;t load: {skipped.join(", ")}
        </p>
      )}
      <p className="presenter-hint">
        {audienceOpen
          ? "Drag the audience window onto the projector, then double-click it for full screen."
          : "Open the audience window to show lyrics on the projector."}{" "}
        Keys: arrows or Space to move, B to blank, − and + for text size.
      </p>
      <div
        className="presenter-main"
        style={{ "--presenter-scale": scale } as React.CSSProperties}
      >
        <section className="presenter-panel" aria-label="Now showing">
          <h2>
            Now showing{slide.label ? ` · ${slide.label}` : ""}
            {blank && <span className="presenter-blanked">Screen blanked</span>}
          </h2>
          <div className={blank ? "presenter-screen blanked" : "presenter-screen"}>
            <SlideFace slide={slide} />
          </div>
        </section>
        <section className="presenter-panel" aria-label="Next slide">
          <h2>Next{next?.label ? ` · ${next.label}` : ""}</h2>
          <div className="presenter-screen next">
            {next ? <SlideFace slide={next} /> : <p className="presenter-end">End of slides</p>}
          </div>
        </section>
      </div>
      <ol ref={list} className="presenter-list" aria-label="All slides">
        {songs.map((song, songIndex) => (
          <li key={songIndex}>
            <h3>{song.title.trim() || "Untitled song"}</h3>
            <ol>
              {slides.map((item, i) =>
                item.songIndex === songIndex ? (
                  <li key={i}>
                    <button
                      className="presenter-slide-button"
                      aria-current={i === index ? "true" : undefined}
                      onClick={() => setIndex(i)}
                    >
                      <span className="presenter-slide-number">{i + 1}</span>
                      <span>
                        {item.kind === "title" ? "Title" : item.label ?? ""}
                        <span className="presenter-slide-text">{item.lines[0]}</span>
                      </span>
                    </button>
                  </li>
                ) : null,
              )}
            </ol>
          </li>
        ))}
      </ol>
      {audience &&
        createPortal(blank ? null : <SlideFace slide={slide} />, audience.root)}
    </dialog>
  );
}
