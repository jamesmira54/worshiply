import type { GuitarDiagram, PianoDiagram } from "@/types/chord";
import { modulo, noteToPitch, parseChord } from "./chord-utils";

const OPEN: Record<string, number[]> = {
  C: [-1, 3, 2, 0, 1, 0],
  D: [-1, -1, 0, 2, 3, 2],
  E: [0, 2, 2, 1, 0, 0],
  F: [1, 3, 3, 2, 1, 1],
  G: [3, 2, 0, 0, 0, 3],
  A: [-1, 0, 2, 2, 2, 0],
  Am: [-1, 0, 2, 2, 1, 0],
  Dm: [-1, -1, 0, 2, 3, 1],
  Em: [0, 2, 2, 0, 0, 0],
  C7: [-1, 3, 2, 3, 1, 0],
  D7: [-1, -1, 0, 2, 1, 2],
  E7: [0, 2, 0, 1, 0, 0],
  G7: [3, 2, 0, 0, 0, 1],
  A7: [-1, 0, 2, 0, 2, 0],
  Am7: [-1, 0, 2, 0, 1, 0],
  Em7: [0, 2, 0, 0, 0, 0],
  Dm7: [-1, -1, 0, 2, 1, 1],
  Cmaj7: [-1, 3, 2, 0, 0, 0],
  Dsus2: [-1, -1, 0, 2, 3, 0],
  Dsus4: [-1, -1, 0, 2, 3, 3],
  Asus2: [-1, 0, 2, 2, 0, 0],
  Asus4: [-1, 0, 2, 2, 3, 0],
  "C/E": [0, 3, 2, 0, 1, 0],
  "D/F#": [2, -1, 0, 2, 3, 2],
  "G/B": [-1, 2, 0, 0, 0, 3],
};
const MOVABLE: Record<string, number[]> = {
  "": [0, 2, 2, 1, 0, 0],
  m: [0, 2, 2, 0, 0, 0],
  "7": [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  sus4: [0, 2, 2, 2, 0, 0],
};
export function getGuitarDiagram(chord: string): GuitarDiagram | null {
  const parsed = parseChord(chord);
  if (!parsed) return null;
  let frets = OPEN[chord]?.slice();
  if (!frets) {
    if (parsed.bass) return null;
    const pattern = MOVABLE[parsed.modifier];
    if (!pattern) return null;
    const offset = modulo(noteToPitch(parsed.root)! - 4);
    frets = pattern.map((fret) => fret + offset);
  }
  const positive = frets.filter((fret) => fret > 0);
  return {
    frets,
    baseFret: Math.max(...positive) <= 4 ? 1 : Math.min(...positive),
  };
}
const INTERVALS: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  min: [0, 3, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  M7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  sus: [0, 5, 7],
  add9: [0, 4, 7, 2],
  add2: [0, 2, 4, 7],
  add4: [0, 4, 5, 7],
  dim: [0, 3, 6],
  "°": [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  ø7: [0, 3, 6, 10],
  aug: [0, 4, 8],
  "+": [0, 4, 8],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  "9": [0, 4, 7, 10, 2],
  maj9: [0, 4, 7, 11, 2],
  m9: [0, 3, 7, 10, 2],
};
export function getPianoDiagram(chord: string): PianoDiagram | null {
  const parsed = parseChord(chord);
  if (!parsed || !INTERVALS[parsed.modifier]) return null;
  const root = noteToPitch(parsed.root)!;
  const notes = INTERVALS[parsed.modifier].map((interval) =>
    modulo(root + interval),
  );
  if (parsed.bass) notes.push(noteToPitch(parsed.bass)!);
  return { root, notes: [...new Set(notes)].sort((a, b) => a - b) };
}
