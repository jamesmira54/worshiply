import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { wrapSegments, filename } from "../lib/export/layout";
import { buildDocx } from "../lib/export/docx";
import { buildPdf } from "../lib/export/pdf";
import { exportModel } from "../lib/export/model";
import { exampleSong } from "../lib/song-defaults";

test("wrapped chord anchors retain every lyric character and chord exactly once", () => {
  const segments = [
    { chord: "Cmaj7", lyric: "A very long phrase with many words " },
    { chord: "G/B", lyric: "  and intentional spacing" },
    { chord: "Am7", lyric: "" },
  ];
  const rows = wrapSegments(segments, 90, (text) => text.length * 5);
  assert.equal(
    rows
      .flat()
      .map((segment) => segment.lyric)
      .join(""),
    segments.map((segment) => segment.lyric).join(""),
  );
  assert.deepEqual(
    rows
      .flat()
      .filter((segment) => segment.chord)
      .map((segment) => segment.chord),
    ["Cmaj7", "G/B", "Am7"],
  );
  assert.ok(
    rows.every((row) =>
      row.every((segment) => segment.x + segment.width <= 90),
    ),
  );
});

test("export model uses transposed parser and deduplicates instrument diagrams", () => {
  const model = exportModel({
    ...exampleSong,
    lyrics: "[Chorus]\n[C]Hello [C]again [G/B]world",
    defaultKey: "D",
    chordDiagramType: "both",
  });
  assert.deepEqual(
    model.diagrams.map((diagram) => `${diagram.type}:${diagram.name}`),
    ["guitar:D", "guitar:A/C#", "piano:D", "piano:A/C#"],
  );
  assert.equal(model.lines[0].type, "section");
});

test("exports preserve editable text, metadata, chord cells, and landscape page settings", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const name = String(input).split("/").pop()!;
    return new Response(await readFile(`public/fonts/${name}`));
  };
  try {
    const song = {
      ...exampleSong,
      title: "Morning café",
      defaultKey: "D",
      chordDiagramType: "none" as const,
      orientation: "landscape" as const,
      lyrics: "[Chorus]\n[C]Hello [G/B]world\n\nPlain lyric line",
    };
    const blob = await buildDocx(song);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const xml = strFromU8(files["word/document.xml"]);
    assert.ok(xml.includes("Morning café"));
    assert.ok(xml.includes("Hello "));
    assert.ok(xml.includes("A/C#"));
    assert.ok(xml.includes('w:orient="landscape"'));
    assert.ok(xml.includes("w:cantSplit"));
    assert.ok(!xml.includes("w:drawing"));
    const pdf = await buildPdf({
      ...song,
      lyrics: Array(180).fill("[C]Hello [G/B]world").join("\n"),
    });
    assert.ok(pdf.getNumberOfPages() > 1);
    assert.ok(
      pdf.internal.pageSize.getWidth() > pdf.internal.pageSize.getHeight(),
    );
    assert.ok(pdf.output("arraybuffer").byteLength > 10000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("download names cannot contain reserved filename characters", () => {
  assert.equal(filename("A/B: song?", "pdf"), "AB song.pdf");
});
