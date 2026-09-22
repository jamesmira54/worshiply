import type { LyricSegment, ParsedLine } from "@/types/chord";
import { isChord } from "./chord-utils";

export function parseLyrics(source: string): ParsedLine[] {
  return source.split(/\r\n|\n|\r/).map((line): ParsedLine => {
    if (line === "") return { type: "blank" };
    const section =
      /^\s*\[((?:repeat\s+)?(?:verse|chorus|pre[- ]?chorus|post[- ]?chorus|bridge|intro|outro|instrumental|interlude|refrain|tag|ending|solo)(?:\s+[^\]]*)?)\]\s*$/i.exec(
        line,
      );
    if (section) return { type: "section", label: section[1] };
    const segments: LyricSegment[] = [];
    let current: LyricSegment = { lyric: "" };
    let position = 0;
    for (const match of line.matchAll(/\[([^\]\r\n]+)\]/g)) {
      if (!isChord(match[1])) continue;
      current.lyric += line.slice(position, match.index);
      if (current.lyric || current.chord) segments.push(current);
      current = { chord: match[1], lyric: "" };
      position = match.index + match[0].length;
    }
    current.lyric += line.slice(position);
    if (current.lyric || current.chord || !segments.length)
      segments.push(current);
    return { type: "lyric", segments };
  });
}
