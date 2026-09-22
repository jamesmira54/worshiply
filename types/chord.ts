export interface LyricSegment {
  chord?: string;
  lyric: string;
}
export type ParsedLine =
  | { type: "section"; label: string }
  | { type: "blank" }
  | { type: "lyric"; segments: LyricSegment[] };
export interface ParsedChord {
  root: string;
  modifier: string;
  bass?: string;
}
export interface GuitarDiagram {
  frets: number[];
  baseFret: number;
}
export interface PianoDiagram {
  notes: number[];
  root: number;
}
