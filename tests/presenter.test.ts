import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SCALE_INDEX,
  TEXT_SCALES,
  deckSlides,
  fitFontSize,
  passageSlides,
  songSlides,
  splitLines,
} from "../lib/presenter";

const song = (lyrics: string, title = "Song", artist = "") => ({ title, artist, lyrics });
const lyricLines = (lyrics: string) =>
  songSlides(song(lyrics)).filter((s) => s.kind === "lyrics").map((s) => s.lines);

test("chords are stripped and chord-only lines are dropped", () => {
  assert.deepEqual(lyricLines("[G]  [D/F#]\n[G]Amazing [C]grace, how [G]sweet"), [
    ["Amazing grace, how sweet"],
  ]);
});

test("section headings and blank lines start new slides", () => {
  const slides = songSlides(song("[Verse 1]\nOne\nTwo\n\nThree\n[Chorus]\n\nFour"));
  assert.deepEqual(
    slides.slice(1).map((s) => [s.label, s.lines]),
    [
      ["Verse 1", ["One", "Two"]],
      [undefined, ["Three"]],
      ["Chorus", ["Four"]],
    ],
  );
});

test("long groups split into balanced slides of at most 4 lines", () => {
  const sizes = (n: number) =>
    splitLines(Array.from({ length: n }, (_, i) => `L${i}`)).map((c) => c.length);
  assert.deepEqual(sizes(4), [4]);
  assert.deepEqual(sizes(5), [3, 2]);
  assert.deepEqual(sizes(6), [3, 3]);
  assert.deepEqual(sizes(9), [3, 3, 3]);
  assert.deepEqual(sizes(0), []);
  assert.deepEqual(
    splitLines(["a", "b", "c", "d", "e"]),
    [["a", "b", "c"], ["d", "e"]],
  );
});

test("each song starts with a title slide, with the artist when present", () => {
  assert.deepEqual(songSlides(song("", "Way Maker", "Sinach"))[0], {
    kind: "title",
    groupIndex: 0,
    groupTitle: "Way Maker",
    lines: ["Way Maker", "Sinach"],
  });
  assert.deepEqual(songSlides(song("", "  ", " "))[0].lines, ["Untitled song"]);
});

test("a song without lyrics is only its title slide", () => {
  assert.equal(songSlides(song("")).length, 1);
  assert.equal(songSlides(song("[Verse]\n\n[C] [G]")).length, 1);
});

test("a deck keeps song order and tags each slide with its song", () => {
  const deck = deckSlides([song("A line", "First"), song("B line", "Second")]);
  assert.deepEqual(
    deck.map((s) => [s.groupIndex, s.kind, s.lines[0]]),
    [
      [0, "title", "First"],
      [0, "lyrics", "A line"],
      [1, "title", "Second"],
      [1, "lyrics", "B line"],
    ],
  );
});

test("text fits at the start size when it can", () => {
  assert.equal(fitFontSize(60, 12, () => true), 60);
});

test("text shrinks to the largest size that fits, within half a pixel", () => {
  const size = fitFontSize(60, 12, (s) => s <= 37.3);
  assert.ok(size <= 37.3 && size > 36.8, String(size));
});

test("text never goes below the minimum size", () => {
  assert.equal(fitFontSize(60, 12, () => false), 12);
  assert.equal(fitFontSize(10, 12, () => true), 12);
});

test("text size steps run 60% to 150% and start at 100%", () => {
  assert.deepEqual(TEXT_SCALES, [0.6, 0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5]);
  assert.equal(TEXT_SCALES[DEFAULT_SCALE_INDEX], 1);
});

test("passages become one captioned slide per verse, grouped in list order", () => {
  const slides = passageSlides([
    {
      book: "John",
      reference: "John 3:16–17",
      verses: [
        { chapter: 3, verse: 16, text: "For God so loved" },
        { chapter: 3, verse: 17, text: "For God sent not" },
      ],
    },
    { book: "Psalms", reference: "Psalms 117:2", verses: [{ chapter: 117, verse: 2, text: "For his merciful" }] },
  ]);
  assert.deepEqual(
    slides.map((s) => [s.kind, s.groupIndex, s.groupTitle, s.label, s.lines, s.caption]),
    [
      ["verse", 0, "John 3:16–17", "3:16", ["For God so loved"], "John 3:16 KJV"],
      ["verse", 0, "John 3:16–17", "3:17", ["For God sent not"], "John 3:17 KJV"],
      ["verse", 1, "Psalms 117:2", "117:2", ["For his merciful"], "Psalms 117:2 KJV"],
    ],
  );
  assert.deepEqual(passageSlides([]), []);
});
