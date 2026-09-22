import {
  FLAT_NOTES,
  SHARP_NOTES,
  modulo,
  noteToPitch,
  parseChord,
} from "./chord-utils";

export function getSemitoneDelta(fromKey: string, toKey: string): number {
  const from = noteToPitch(fromKey.replace(/m$/, ""));
  const to = noteToPitch(toKey.replace(/m$/, ""));
  if (from === null || to === null) return 0;
  const delta = modulo(to - from);
  return delta > 6 ? delta - 12 : delta;
}
export function transposeChord(
  chord: string,
  semitones: number,
  preferFlats = false,
): string {
  const parsed = parseChord(chord);
  if (
    !parsed ||
    !Number.isFinite(semitones) ||
    !Number.isInteger(semitones) ||
    modulo(semitones) === 0
  )
    return chord;
  const names = preferFlats ? FLAT_NOTES : SHARP_NOTES;
  const shift = (note: string) => names[modulo(noteToPitch(note)! + semitones)];
  return (
    shift(parsed.root) +
    parsed.modifier +
    (parsed.bass ? "/" + shift(parsed.bass) : "")
  );
}
export function transposeLyrics(
  source: string,
  fromKey: string,
  toKey: string,
): string {
  const delta = getSemitoneDelta(fromKey, toKey);
  const preferFlats = /[b♭]/.test(toKey) || toKey === "F";
  return source.replace(/\[([^\]\r\n]+)\]/g, (match, chord: string) =>
    parseChord(chord)
      ? `[${transposeChord(chord, delta, preferFlats)}]`
      : match,
  );
}
