export type ChordDiagramType = "guitar" | "piano" | "both" | "none";
export const SONG_CATEGORIES = ["Praise & Worship", "Singspiration", "Hymnal"] as const;
export type SongCategory = (typeof SONG_CATEGORIES)[number];
export const DEFAULT_CATEGORY: SongCategory = "Praise & Worship";

export interface Song {
  category: SongCategory;
  id: string;
  slug: string;
  title: string;
  artist: string;
  lyrics: string;
  originalKey: string;
  defaultKey: string;
  bpm: string;
  timeSignature: string;
  capo: string;
  notes: string;
  chordDiagramType: ChordDiagramType;
  fontSize: number;
  showChords: boolean;
  orientation: "portrait" | "landscape";
  createdAt: string;
  updatedAt: string;
}
export type SongInput = Omit<Song, "id" | "slug" | "createdAt" | "updatedAt">;
