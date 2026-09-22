import type { ParsedChord, ParsedLine } from "@/types/chord";

export const KEYS = [
  "C",
  "C#",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;
export const SHARP_NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
export const FLAT_NOTES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];
export const modulo = (value: number): number => ((value % 12) + 12) % 12;
export function noteToPitch(note: string): number | null {
  const match = /^([A-G])([#b♯♭]?)$/.exec(note);
  if (!match) return null;
  const pitch = (
    { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as Record<string, number>
  )[match[1]];
  return modulo(
    pitch +
      (["#", "♯"].includes(match[2])
        ? 1
        : ["b", "♭"].includes(match[2])
          ? -1
          : 0),
  );
}
// Recognize musical modifiers without misclassifying bracketed prose as chords.
export function parseChord(value: string): ParsedChord | null {
  const match =
    /^([A-G][#b♯♭]?)((?:(?:maj|min|dim|aug|sus|add|omit|no|m|M|Δ|ø|°|\+|-)|[0-9#b(),])*)(?:\/([A-G][#b♯♭]?))?$/.exec(
      value,
    );
  return match
    ? {
        root: match[1],
        modifier: match[2],
        ...(match[3] ? { bass: match[3] } : {}),
      }
    : null;
}
export const isChord = (value: string): boolean => parseChord(value) !== null;
export function getUniqueChords(lines: ParsedLine[]): string[] {
  return [
    ...new Set(
      lines.flatMap((line) =>
        line.type === "lyric"
          ? line.segments.flatMap((segment) =>
              segment.chord ? [segment.chord] : [],
            )
          : [],
      ),
    ),
  ];
}
