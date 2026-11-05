"use client";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  AArrowDown,
  AArrowUp,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Pause,
  Play,
  Rabbit,
  Turtle,
  X,
} from "lucide-react";
import type { Song, SongInput } from "@/types/song";
import type { Lineup, SlotKey } from "@/types/lineup";
import { api } from "@/lib/api";
import { sundayQueue, type LineupPlace } from "@/lib/lineups";
import {
  DEFAULT_SPEED_INDEX,
  SCROLL_SPEEDS,
  TEXT_SIZES,
  initialTextSizeIndex,
  nextScrollPosition,
  stepIndex,
} from "@/lib/performance";
import { ChordSheet } from "@/components/chord-sheet/ChordSheet";

// Full screen goes on the stage, not the dialog: a <dialog> cannot be the
// fullscreen element, and the stage stays inside the modal's focus scope.
type Queue = ReturnType<typeof sundayQueue>;

export function PerformanceView({
  song,
  lineup,
  onClose,
}: {
  song: SongInput;
  lineup?: LineupPlace;
  onClose: (showing?: { slug: string; slot: SlotKey }) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const navigation = useRef<AbortController | null>(null);
  const [current, setCurrent] = useState<SongInput>(song);
  const [queue, setQueue] = useState<Queue>([]);
  const [position, setPosition] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [navError, setNavError] = useState("");
  const [sizeIndex, setSizeIndex] = useState(() =>
    initialTextSizeIndex(song.fontSize),
  );
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);

  // Open: modal, full screen, and screen wake lock. Close undoes all three.
  useEffect(() => {
    const element = dialog.current;
    const area = stage.current;
    if (!element || !area) return;
    element.showModal();
    area.focus();

    const supported =
      document.fullscreenEnabled && typeof area.requestFullscreen === "function";
    setCanFullscreen(supported);
    if (supported) area.requestFullscreen().catch(() => {});
    const onFullscreenChange = () =>
      setFullscreen(document.fullscreenElement === area);
    document.addEventListener("fullscreenchange", onFullscreenChange);

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
      else setPlaying(false);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      closed = true;
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release().catch(() => {});
      if (document.fullscreenElement === area)
        void document.exitFullscreen().catch(() => {});
      element.close();
    };
  }, []);

  // Lineup navigation: lineup reads need sign-in, so any failure just leaves it off.
  useEffect(() => {
    if (!lineup) return;
    const controller = new AbortController();
    api<{ lineup: Lineup }>(`/api/lineups/${encodeURIComponent(lineup.id)}`, {
      signal: controller.signal,
    })
      .then((data) => {
        const items = sundayQueue(data.lineup, lineup.sunday);
        setQueue(items);
        setPosition(items.findIndex((item) => item.slot === lineup.slot));
      })
      .catch(() => {});
    return () => {
      controller.abort();
      navigation.current?.abort();
    };
  }, [lineup]);

  async function go(delta: number) {
    const target = queue[position + delta];
    if (!target) return;
    navigation.current?.abort();
    const controller = new AbortController();
    navigation.current = controller;
    setLoading(true);
    setNavError("");
    try {
      const data = await api<{ song: Song }>(`/api/songs/${encodeURIComponent(target.slug)}`, {
        signal: controller.signal,
      });
      setPlaying(false);
      setCurrent(data.song);
      setPosition(position + delta);
      if (stage.current) stage.current.scrollTop = 0;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setNavError(e instanceof Error ? e.message : "Could not open that song.");
    } finally {
      if (navigation.current === controller) setLoading(false);
    }
  }

  function close() {
    const showing = queue[position];
    onClose(showing ? { slug: showing.slug, slot: showing.slot } : undefined);
  }

  // Auto-scroll. A manual scroll moves the tracked position, so play carries on
  // from wherever the player scrolled to.
  useEffect(() => {
    const area = stage.current;
    if (!playing || !area) return;
    let position = area.scrollTop;
    let last: number | null = null;
    let frame = 0;
    const tick = (now: number) => {
      if (Math.abs(area.scrollTop - position) > 2) position = area.scrollTop;
      const step = nextScrollPosition(
        position,
        SCROLL_SPEEDS[speedIndex],
        last === null ? 0 : now - last,
        Math.max(0, area.scrollHeight - area.clientHeight),
      );
      last = now;
      position = step.position;
      area.scrollTop = position;
      if (step.atEnd) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speedIndex]);

  function togglePlaying() {
    const area = stage.current;
    if (!playing && area && area.scrollTop >= area.scrollHeight - area.clientHeight - 1)
      area.scrollTop = 0;
    setPlaying(!playing);
  }

  function toggleFullscreen() {
    const area = stage.current;
    if (!area) return;
    const change =
      document.fullscreenElement === area
        ? document.exitFullscreen()
        : area.requestFullscreen();
    change.catch(() => {});
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== " ") return;
    const target = event.target;
    if (target instanceof HTMLButtonElement || target instanceof HTMLSelectElement)
      return;
    event.preventDefault();
    togglePlaying();
  }

  const size = TEXT_SIZES[sizeIndex];
  const title = current.title || "Untitled song";
  const previous = queue[position - 1];
  const next = queue[position + 1];
  return (
    <dialog
      ref={dialog}
      className="performance-dialog no-print"
      aria-label={`Performance mode: ${title}`}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div
        ref={stage}
        className="performance-stage"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {/* Two rows on phones: navigation first, then text size and scrolling.
            Wide screens show both rows as one line (CSS). */}
        <div className="performance-controls">
          <div className="performance-row">
            <button className="button" aria-label="Exit performance mode" onClick={close}>
              <X size={18} /> <span className="performance-label">Exit</span>
            </button>
            {position >= 0 && (
              <div className="performance-group" role="group" aria-label="Lineup songs">
                <button
                  className="button"
                  disabled={!previous || loading}
                  aria-label={previous ? `Previous song: ${previous.title}` : "No previous song"}
                  onClick={() => void go(-1)}
                >
                  <ChevronLeft size={18} />
                  <span className="performance-label performance-nav-title">
                    {previous?.title ?? "Previous"}
                  </span>
                </button>
                <span className="performance-value" aria-live="polite">
                  {loading ? (
                    "Loading…"
                  ) : (
                    <>
                      <span className="performance-long">
                        Song {position + 1} of {queue.length} · {queue[position].label}
                      </span>
                      <span className="performance-short" aria-hidden="true">
                        {position + 1}/{queue.length}
                      </span>
                    </>
                  )}
                </span>
                <button
                  className="button"
                  disabled={!next || loading}
                  aria-label={next ? `Next song: ${next.title}` : "No next song"}
                  onClick={() => void go(1)}
                >
                  <span className="performance-label performance-nav-title">
                    {next?.title ?? "Next"}
                  </span>
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
            {canFullscreen && (
              <button
                className="button"
                aria-label="Full screen"
                aria-pressed={fullscreen}
                onClick={toggleFullscreen}
              >
                {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                <span className="performance-label">Full screen</span>
              </button>
            )}
          </div>
          <div className="performance-row">
            <div className="performance-group" role="group" aria-label="Text size">
              <button
                className="icon-button"
                aria-label="Smaller text"
                disabled={sizeIndex === 0}
                onClick={() => setSizeIndex(stepIndex(TEXT_SIZES.length, sizeIndex, -1))}
              >
                <AArrowDown size={20} />
              </button>
              <span className="performance-value">{size} pt</span>
              <button
                className="icon-button"
                aria-label="Larger text"
                disabled={sizeIndex === TEXT_SIZES.length - 1}
                onClick={() => setSizeIndex(stepIndex(TEXT_SIZES.length, sizeIndex, 1))}
              >
                <AArrowUp size={20} />
              </button>
            </div>
            <div className="performance-group" role="group" aria-label="Auto-scroll">
              <button
                className="button primary"
                aria-label={playing ? "Pause auto-scroll" : "Start auto-scroll"}
                onClick={togglePlaying}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
                <span className="performance-label">{playing ? "Pause" : "Play"}</span>
              </button>
              <button
                className="icon-button"
                aria-label="Slower"
                disabled={speedIndex === 0}
                onClick={() => setSpeedIndex(stepIndex(SCROLL_SPEEDS.length, speedIndex, -1))}
              >
                <Turtle size={20} />
              </button>
              <span className="performance-value" aria-live="polite">
                <span className="performance-long">
                  Speed {speedIndex + 1} of {SCROLL_SPEEDS.length}
                </span>
                <span className="performance-short" aria-hidden="true">
                  {speedIndex + 1}/{SCROLL_SPEEDS.length}
                </span>
              </span>
              <button
                className="icon-button"
                aria-label="Faster"
                disabled={speedIndex === SCROLL_SPEEDS.length - 1}
                onClick={() => setSpeedIndex(stepIndex(SCROLL_SPEEDS.length, speedIndex, 1))}
              >
                <Rabbit size={20} />
              </button>
            </div>
          </div>
        </div>
        {navError && (
          <p className="notice error performance-error" role="alert">
            {navError}
          </p>
        )}
        <ChordSheet song={{ ...current, fontSize: size }} />
      </div>
    </dialog>
  );
}
