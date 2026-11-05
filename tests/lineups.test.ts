import test from "node:test";
import assert from "node:assert/strict";
import { SLOTS, sundaysInMonth, formatSunday, sundayQueue } from "../lib/lineups";
import type { Lineup, LineupSong } from "../types/lineup";
import {
  ApiError,
  validateMonth,
  validateSlotAssignment,
} from "../lib/server/validation";

const SONG_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

test("every calendar Sunday of a month is listed in order", () => {
  assert.deepEqual(sundaysInMonth("2026-10"), [
    "2026-10-04",
    "2026-10-11",
    "2026-10-18",
    "2026-10-25",
  ]);
  assert.deepEqual(sundaysInMonth("2026-11"), [
    "2026-11-01",
    "2026-11-08",
    "2026-11-15",
    "2026-11-22",
    "2026-11-29",
  ]);
  assert.deepEqual(sundaysInMonth("2026-03"), [
    "2026-03-01",
    "2026-03-08",
    "2026-03-15",
    "2026-03-22",
    "2026-03-29",
  ]);
  assert.deepEqual(sundaysInMonth("2028-02"), [
    "2028-02-06",
    "2028-02-13",
    "2028-02-20",
    "2028-02-27",
  ]);
  assert.throws(() => sundaysInMonth("2026-13"));
  assert.equal(formatSunday("2026-10-04"), "Sunday, October 4");
});

test("months must be YYYY-MM between 2000 and 2100", () => {
  assert.equal(validateMonth("2026-10"), "2026-10");
  for (const month of ["2026-13", "2026-1", "1999-12", "2101-01", "", 202610, null])
    assert.throws(() => validateMonth(month), ApiError);
});

test("slot assignments are bounded to the month, known slots, and song ids", () => {
  assert.deepEqual(
    validateSlotAssignment({ sunday: "2026-10-04", slot: "worship1", songId: SONG_ID }, "2026-10"),
    { sunday: "2026-10-04", slot: "worship1", songId: SONG_ID },
  );
  assert.equal(
    validateSlotAssignment({ sunday: "2026-10-04", slot: "closing", songId: null }, "2026-10").songId,
    null,
  );
  for (const input of [
    null,
    [],
    { sunday: "2026-10-05", slot: "closing", songId: SONG_ID },
    { sunday: "2026-11-01", slot: "closing", songId: SONG_ID },
    { sunday: "2026-10-04", slot: "offertory", songId: SONG_ID },
    { sunday: "2026-10-04", slot: "closing", songId: "not-a-uuid" },
    { sunday: "2026-10-04", slot: "closing", songId: "" },
    { sunday: "2026-10-04", slot: "closing" },
  ])
    assert.throws(() => validateSlotAssignment(input, "2026-10"), ApiError);
});

const song = (slug: string): LineupSong => ({
  id: SONG_ID,
  slug,
  title: `Title ${slug}`,
  artist: "",
  category: "Praise & Worship",
  defaultKey: "C",
});
const lineup: Lineup = {
  id: "lineup",
  month: "2026-10",
  updatedAt: "",
  sundays: [
    {
      date: "2026-10-04",
      slots: { singspiration: song("a"), worship1: song("b"), worship2: song("c"), closing: song("d") },
    },
    {
      date: "2026-10-11",
      slots: { singspiration: null, worship1: song("b"), worship2: { removed: true }, closing: song("b") },
    },
  ],
};

test("a Sunday queue lists assigned songs in slot order", () => {
  assert.deepEqual(
    sundayQueue(lineup, "2026-10-04").map((item) => [item.slot, item.slug]),
    [["singspiration", "a"], ["worship1", "b"], ["worship2", "c"], ["closing", "d"]],
  );
  assert.deepEqual(sundayQueue(lineup, "2026-10-04")[1], {
    slot: "worship1",
    label: "Worship song 1",
    slug: "b",
    title: "Title b",
  });
});

test("a Sunday queue skips empty and removed slots and keeps repeats", () => {
  assert.deepEqual(
    sundayQueue(lineup, "2026-10-11").map((item) => [item.slot, item.slug]),
    [["worship1", "b"], ["closing", "b"]],
  );
  assert.deepEqual(sundayQueue(lineup, "2026-10-18"), []);
});

test("slot categories match the Sunday lineup rules", () => {
  assert.deepEqual(
    SLOTS.map((slot) => [slot.key, slot.category]),
    [
      ["singspiration", "Singspiration"],
      ["worship1", "Praise & Worship"],
      ["worship2", "Praise & Worship"],
      ["closing", null],
    ],
  );
});
