import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SPEED_INDEX,
  SCROLL_SPEEDS,
  TEXT_SIZES,
  initialTextSizeIndex,
  nextScrollPosition,
  stepIndex,
} from "../lib/performance";

test("steps clamp at both ends", () => {
  assert.equal(stepIndex(7, 0, -1), 0);
  assert.equal(stepIndex(7, 6, 1), 6);
  assert.equal(stepIndex(7, 2, 1), 3);
  assert.equal(stepIndex(7, 2, -1), 1);
});

test("default speed is speed 3 of 7 at 20 px/s", () => {
  assert.equal(SCROLL_SPEEDS.length, 7);
  assert.equal(DEFAULT_SPEED_INDEX, 2);
  assert.equal(SCROLL_SPEEDS[DEFAULT_SPEED_INDEX], 20);
});

test("performance text starts at 26pt or the song's larger size", () => {
  const size = (fontSize: number) => TEXT_SIZES[initialTextSizeIndex(fontSize)];
  assert.equal(size(10), 26);
  assert.equal(size(26), 26);
  assert.equal(size(30), 32);
  assert.equal(size(48), 48);
  assert.equal(size(64), 48);
});

test("scrolling advances by fractional pixels", () => {
  const step = nextScrollPosition(100, 15, 16, 1000);
  assert.ok(Math.abs(step.position - 100.24) < 1e-9);
  assert.equal(step.atEnd, false);
});

test("scrolling stops exactly at the end", () => {
  assert.deepEqual(nextScrollPosition(995, 80, 100, 1000), {
    position: 1000,
    atEnd: true,
  });
  assert.deepEqual(nextScrollPosition(1000, 10, 16, 1000), {
    position: 1000,
    atEnd: true,
  });
});

test("long or negative frame gaps cannot jump the song", () => {
  assert.equal(nextScrollPosition(0, 20, 60_000, 5000).position, 2);
  assert.equal(nextScrollPosition(50, 20, -40, 5000).position, 50);
});
