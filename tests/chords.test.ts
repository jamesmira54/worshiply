import test from "node:test";
import assert from "node:assert/strict";
import { parseLyrics } from "../lib/chord-parser";
import { getUniqueChords } from "../lib/chord-utils";
import {
  getSemitoneDelta,
  transposeChord,
  transposeLyrics,
} from "../lib/chord-transposer";
import { getGuitarDiagram, getPianoDiagram } from "../lib/chord-diagrams";

test("parser preserves whitespace, adjacent chords, unknown brackets and blank lines", () => {
  assert.deepEqual(
    parseLyrics("[Verse 1]\n  [C]Hi  [not a chord] [G][Am7]there\n\n"),
    [
      { type: "section", label: "Verse 1" },
      {
        type: "lyric",
        segments: [
          { lyric: "  " },
          { chord: "C", lyric: "Hi  [not a chord] " },
          { chord: "G", lyric: "" },
          { chord: "Am7", lyric: "there" },
        ],
      },
      { type: "blank" },
      { type: "blank" },
    ],
  );
  assert.deepEqual(parseLyrics("   "), [
    { type: "lyric", segments: [{ lyric: "   " }] },
  ]);
});
test("transposition changes roots and bass notes and preserves modifiers and prose", () => {
  assert.equal(transposeChord("Cmaj7/E", 2), "Dmaj7/F#");
  assert.equal(transposeChord("F#m7b5/C#", -2), "Em7b5/B");
  assert.equal(transposeChord("Bbsus4/F", 2, true), "Csus4/G");
  assert.equal(
    transposeLyrics("[Chorus]\r\n[C]word [G/B]word [Keep this]", "C", "D"),
    "[Chorus]\r\n[D]word [A/C#]word [Keep this]",
  );
  assert.equal(transposeChord("Bb", 12), "Bb");
  assert.equal(getSemitoneDelta("B", "C"), 1);
  assert.equal(getSemitoneDelta("C", "B"), -1);
});
test("unique chords retain first appearance order", () => {
  assert.deepEqual(
    getUniqueChords(parseLyrics("[C]one [G]two [C]three\n[C/E]four")),
    ["C", "G", "C/E"],
  );
});
test("diagrams use real pitch classes and unsupported voicings are explicit", () => {
  assert.deepEqual(getPianoDiagram("Cm7")?.notes, [0, 3, 7, 10]);
  assert.deepEqual(getPianoDiagram("D/F#")?.notes, [2, 6, 9]);
  assert.equal(getPianoDiagram("C13b9"), null);
  assert.equal(getGuitarDiagram("C13b9"), null);
  assert.equal(getGuitarDiagram("C/F#"), null);
  const bMinor = getGuitarDiagram("Bm");
  assert.ok(bMinor);
  const pitches = [4, 9, 2, 7, 11, 4].map(
    (open, i) => (open + bMinor.frets[i]) % 12,
  );
  assert.ok(pitches.every((pitch) => [11, 2, 6].includes(pitch)));
});
