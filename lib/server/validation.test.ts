import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, validateSong } from "./validation";
import { SONG_CATEGORIES } from "../../types/song";

test("reference videos are optional and stored in canonical form", () => {
  assert.equal(validateSong({ title: "Legacy" }).referenceVideo, "");
  assert.equal(validateSong({ title: "Song", referenceVideo: "  " }).referenceVideo, "");
  // null is treated as missing, like every other song field.
  assert.equal(validateSong({ title: "Song", referenceVideo: null }).referenceVideo, "");
  assert.equal(
    validateSong({ title: "Song", referenceVideo: " https://youtu.be/dQw4w9WgXcQ?t=5 " })
      .referenceVideo,
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  for (const referenceVideo of [
    "hello",
    "https://vimeo.com/123456",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    `https://youtu.be/dQw4w9WgXcQ?x=${"a".repeat(300)}`,
    42,
  ])
    assert.throws(() => validateSong({ title: "Song", referenceVideo }), ApiError);
});

test("categories are fixed and older songs receive a default", () => {
  assert.equal(validateSong({ title: "Legacy" }).category, "Praise & Worship");
  for (const category of SONG_CATEGORIES)
    assert.equal(validateSong({ title: "Song", category }).category, category);
  for (const category of ["Other", "", null, 42])
    assert.throws(() => validateSong({ title: "Song", category }), ApiError);
});

test("song validation returns an explicit, bounded data model", () => {
  const song = validateSong({
    title: "  Our song  ",
    lyrics: "[C]Morning light",
    owner_hash: "injected",
    id: "injected",
  });
  assert.equal(song.title, "Our song");
  assert.equal(song.originalKey, "C");
  assert.equal(song.showChords, true);
  assert.equal("owner_hash" in song, false);
  assert.equal("id" in song, false);
});

test("invalid field types and oversized content are rejected", () => {
  for (const input of [
    null,
    [],
    { title: " " },
    { title: "Song", lyrics: "x".repeat(60001) },
    { title: "Song", originalKey: "H" },
    { title: "Song", bpm: "999" },
    { title: "Song", fontSize: Infinity },
    { title: "Song", capo: "-1" },
    { title: "Song", showChords: "yes" },
  ]) {
    assert.throws(() => validateSong(input), ApiError);
  }
});

test("minor keys, fractional meters, and Unicode text are preserved", () => {
  const song = validateSong({
    title: "Áwít",
    lyrics: "[F#m]Umawit",
    originalKey: "F#m",
    defaultKey: "Am",
    timeSignature: "6/8",
    bpm: "72",
    capo: "2",
  });
  assert.equal(song.defaultKey, "Am");
  assert.equal(song.timeSignature, "6/8");
  assert.equal(song.lyrics, "[F#m]Umawit");
});
