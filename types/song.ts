export type ChordDiagramType = "guitar" | "piano" | "both" | "none";
export interface Song {
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
