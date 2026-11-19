import { parseLyrics } from "./chord-parser";

export type Slide = {
  kind: "title" | "lyrics";
  songIndex: number;
  songTitle: string;
  /** Section name, shown only in the control window. */
  label?: string;
  lines: string[];
};

type PresentedSong = { title: string; artist: string; lyrics: string };

/** Split a long group into balanced slides of at most `max` lines (5 -> 3+2). */
export function splitLines(lines: string[], max = 4): string[][] {
  if (lines.length === 0) return [];
  const count = Math.ceil(lines.length / max);
  const chunks: string[][] = [];
  let start = 0;
  for (let i = 0; i < count; i++) {
    const size = Math.ceil((lines.length - start) / (count - i));
    chunks.push(lines.slice(start, start + size));
    start += size;
  }
  return chunks;
}

/** A title slide, then the lyrics with chords removed: one group per section
 * heading or blank-line stanza, long groups split into slides of up to 4 lines. */
export function songSlides(song: PresentedSong, songIndex = 0): Slide[] {
  const songTitle = song.title.trim() || "Untitled song";
  const artist = song.artist.trim();
  const slides: Slide[] = [
    { kind: "title", songIndex, songTitle, lines: artist ? [songTitle, artist] : [songTitle] },
  ];
  let label: string | undefined;
  let group: string[] = [];
  const flush = () => {
    for (const lines of splitLines(group))
      slides.push({ kind: "lyrics", songIndex, songTitle, label, lines });
    if (group.length) label = undefined;
    group = [];
  };
  for (const line of parseLyrics(song.lyrics)) {
    if (line.type === "section") {
      flush();
      label = line.label;
    } else if (line.type === "blank") {
      flush();
    } else {
      const text = line.segments
        .map((segment) => segment.lyric)
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (text) group.push(text);
    }
  }
  flush();
  return slides;
}

/** Several songs as one slide show, in the given order. */
export function deckSlides(songs: PresentedSong[]): Slide[] {
  return songs.flatMap((song, index) => songSlides(song, index));
}

/** Projector text size steps, as a multiple of the window-based base size. */
export const TEXT_SCALES = [0.6, 0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5];
export const DEFAULT_SCALE_INDEX = 4;

/** The largest font size from `start` down to `min` for which `fits` holds,
 * found by binary search to 0.5px. Returns `min` when nothing fits. */
export function fitFontSize(start: number, min: number, fits: (size: number) => boolean) {
  if (start <= min) return min;
  if (fits(start)) return start;
  let low = min;
  let high = start;
  while (high - low > 0.5) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return low;
}
