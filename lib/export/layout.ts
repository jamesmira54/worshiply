/** All dimensions use points, so PDF and Word share the same wrapping rules. */
export interface LayoutSegment {
  chord?: string | null;
  lyric: string;
}
export interface PositionedSegment {
  chord: string;
  lyric: string;
  x: number;
  width: number;
}
export type MeasureText = (text: string, bold?: boolean) => number;

/** Wrap at word boundaries while keeping every chord attached to its lyric anchor. */
export function wrapSegments(
  segments: readonly LayoutSegment[],
  available: number,
  measure: MeasureText,
  showChords = true,
): PositionedSegment[][] {
  if (available < 30)
    throw new Error("The page is too narrow for this chord sheet.");
  const rows: PositionedSegment[][] = [];
  let row: PositionedSegment[] = [];
  let x = 0;
  const flush = () => {
    if (row.length) rows.push(row);
    row = [];
    x = 0;
  };
  for (const segment of segments) {
    let remaining = segment.lyric;
    let chord = showChords ? (segment.chord ?? "") : "";
    do {
      const chordWidth = chord ? measure(chord, true) + 5 : 0;
      if (chordWidth > available)
        throw new Error("A chord label is too long to fit on the page.");
      if (x && Math.max(chordWidth, measure(remaining)) > available - x) {
        // Keep normal chord/word groups together; split only unusually long groups.
        if (Math.max(chordWidth, measure(remaining)) <= available) flush();
      }
      const room = available - x;
      let count = remaining.length;
      if (measure(remaining) > room) {
        let low = 0,
          high = remaining.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (measure(remaining.slice(0, mid)) <= room) low = mid;
          else high = mid - 1;
        }
        count = low;
        const boundary = remaining.slice(0, count).lastIndexOf(" ");
        if (boundary > 0) count = boundary + 1;
      }
      if ((count === 0 && remaining.length) || chordWidth > room) {
        flush();
        continue;
      }
      const lyric = remaining.slice(0, count);
      const width = Math.max(chordWidth, measure(lyric), 0.5);
      row.push({ chord, lyric, x, width });
      x += width;
      remaining = remaining.slice(count);
      chord = "";
      if (remaining.length) flush();
    } while (remaining.length);
  }
  flush();
  return rows.length ? rows : [[]];
}

export function filename(title: string, extension: string): string {
  const safe = title
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim()
    .replace(/\.+$/, "")
    .slice(0, 100);
  return `${safe || "chord-sheet"}.${extension}`;
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
