import assert from "node:assert/strict";
import test from "node:test";
import {
  hashPassword,
  safeNext,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "./passwords";
import { ApiError } from "./validation";

test("password hashes verify only the original password", async () => {
  const hash = await hashPassword("correct horse battery");
  assert.match(hash, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(await verifyPassword("correct horse battery", hash), true);
  assert.equal(await verifyPassword("correct horse batterY", hash), false);
});

test("each hash uses a fresh salt", async () => {
  assert.notEqual(
    await hashPassword("same password"),
    await hashPassword("same password"),
  );
});

test("malformed stored hashes fail closed", async () => {
  for (const stored of ["", "plain", "scrypt$abc$def", "bcrypt$x$y"])
    assert.equal(await verifyPassword("anything", stored), false);
});

test("usernames are normalized and restricted", () => {
  assert.equal(validateUsername("  Worship.Lead_1 "), "worship.lead_1");
  for (const bad of ["ab", "a".repeat(41), "has space", "émile", 42, null])
    assert.throws(() => validateUsername(bad), ApiError);
});

test("passwords must be 10-200 characters and are not trimmed", () => {
  assert.equal(validatePassword(" ten chars "), " ten chars ");
  for (const bad of ["short", "x".repeat(201), undefined, 1234567890])
    assert.throws(() => validatePassword(bad), ApiError);
});

test("sign-in redirects stay on this site", () => {
  assert.equal(safeNext("/lineups"), "/lineups");
  assert.equal(safeNext("/songs/new?x=1"), "/songs/new?x=1");
  assert.equal(safeNext("/songs/a#b"), "/songs/a#b");
  for (const bad of [
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r\n/evil.example",
    "/..//evil.example",
    "/.//evil.example",
    "/a/..//evil.example",
    "/%2e%2e//evil.example",
    "/songs/../..//evil.example",
    "https://evil.example",
    "",
    undefined,
  ])
    assert.equal(safeNext(bad), "/songs");
});
