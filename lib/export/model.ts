import type { SongInput } from "@/types/song";
import { parseLyrics } from "@/lib/chord-parser";
import { transposeLyrics } from "@/lib/chord-transposer";
import { diagramSvg, type ExportDiagram } from "./diagrams";

export function exportModel(song: SongInput) {
  const lines = parseLyrics(
    transposeLyrics(song.lyrics, song.originalKey, song.defaultKey),
  );
  const chords = [
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
  const diagrams: ExportDiagram[] = [];
  if (song.chordDiagramType !== "none") {
    const instruments: ("guitar" | "piano")[] =
      song.chordDiagramType === "both"
        ? ["guitar", "piano"]
        : [song.chordDiagramType];
    for (const type of instruments)
      for (const name of chords)
        diagrams.push({ name, type, svg: diagramSvg(name, type) });
  }
  return { lines, diagrams, fontSize: song.fontSize };
}
