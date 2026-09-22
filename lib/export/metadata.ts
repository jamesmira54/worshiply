import type { SongInput } from "@/types/song";

export function songMetadata(song: SongInput): string {
  return [
    song.defaultKey && `Key: ${song.defaultKey}`,
    song.originalKey &&
      song.originalKey !== song.defaultKey &&
      `Original: ${song.originalKey}`,
    song.bpm && `${song.bpm} BPM`,
    song.timeSignature && `Time: ${song.timeSignature}`,
    song.capo && `Capo: ${song.capo}`,
  ]
    .filter(Boolean)
    .join("   |   ");
}

export const PAGE_MARGIN = 42.52; // 15 mm
export const A4_PORTRAIT = { width: 595.28, height: 841.89 };
export function pageSize(song: SongInput) {
  return song.orientation === "landscape"
    ? { width: A4_PORTRAIT.height, height: A4_PORTRAIT.width }
    : A4_PORTRAIT;
}
