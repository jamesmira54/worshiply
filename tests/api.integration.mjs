import assert from "node:assert/strict";
const base = "http://localhost:3000";
const title = `Worshiply API check ${Date.now()}`;
const input = {
  title,
  artist: "QA only",
  lyrics: "[Verse 1]\n[C]One [G/B]two",
  originalKey: "C",
  defaultKey: "D",
  bpm: "72",
  timeSignature: "4/4",
  capo: "",
  notes: "",
  chordDiagramType: "both",
  fontSize: 14,
  showChords: true,
  orientation: "portrait",
};
const created = [];
const lineups = [];
let cookie = "";
async function send(path, method = "GET", body, owner = false, origin = base) {
  return fetch(base + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(owner ? { cookie: owner === true ? cookie : owner } : {}),
      ...(method !== "GET" ? { origin } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
try {
  let response = await send("/api/songs", "POST", input);
  assert.equal(response.status, 201);
  cookie = response.headers.get("set-cookie").split(";")[0];
  let data = await response.json();
  created.push(data.song.slug);
  assert.equal(data.canEdit, true);
  assert.equal(data.song.category, "Praise & Worship");
  assert.match(data.song.slug, /^worshiply-api-check-\d+$/);
  response = await send("/api/songs", "POST", input, true);
  assert.equal(response.status, 201);
  let duplicate = await response.json();
  created.push(duplicate.song.slug);
  assert.equal(duplicate.song.slug, data.song.slug + "-2");
  response = await send(`/api/songs/${data.song.slug}`);
  let view = await response.json();
  assert.equal(view.canEdit, false);
  assert.equal(view.song.defaultKey, "D");
  response = await send(`/api/songs/${data.song.slug}`, "PATCH", {
    ...input,
    title: "Unauthorized",
  });
  assert.equal(response.status, 403);
  response = await send(`/api/songs/${data.song.slug}`, "DELETE");
  assert.equal(response.status, 403);
  response = await send(
    `/api/songs/${data.song.slug}`,
    "PATCH",
    input,
    true,
    "https://untrusted.invalid",
  );
  assert.equal(response.status, 403);
  response = await send(
    `/api/songs/${data.song.slug}`,
    "PATCH",
    { ...input, title: title + " updated", defaultKey: "Eb", category: "Hymnal" },
    true,
  );
  assert.equal(response.status, 200);
  response = await send(
    `/api/songs?search=${encodeURIComponent(title)}&key=Eb&sort=title`,
  );
  let results = await response.json();
  assert.equal(results.total, 1);
  assert.equal(results.songs[0].defaultKey, "Eb");
  response = await send(`/api/songs?search=${encodeURIComponent(title)}&category=Hymnal`);
  results = await response.json();
  assert.equal(results.total, 1);
  assert.equal(results.songs[0].category, "Hymnal");
  response = await send(`/api/songs?search=${encodeURIComponent(title)}&category=Singspiration`);
  assert.equal((await response.json()).total, 0);
  response = await send("/api/songs", "POST", { ...input, title: "" }, true);
  assert.equal(response.status, 400);
  response = await send(`/api/songs/${data.song.slug}`, "GET", undefined, true);
  view = await response.json();
  assert.equal(view.canEdit, true);
  assert.equal(view.song.title, title + " updated");
  response = await send("/api/songs", "POST", { ...input, title: "New" }, true);
  assert.equal(response.status, 201);
  const reserved = await response.json();
  created.push(reserved.song.slug);
  assert.notEqual(reserved.song.slug, "new");
  assert.match(reserved.song.slug, /^new-song/);
  console.log(
    "PASS: create, readable unique slugs, reserved routes, public read, owner update, unauthorized update/delete, cross-origin rejection, saved-key search, validation.",
  );

  const month = "2099-02";
  response = await send("/api/lineups", "POST", { month }, true);
  assert.equal(response.status, 201);
  const lineup = (await response.json()).lineup;
  lineups.push({ id: lineup.id, owner: true });
  response = await send("/api/lineups", "POST", { month }, true);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).lineup.id, lineup.id);
  response = await send("/api/lineups", "POST", { month: "2099-13" }, true);
  assert.equal(response.status, 400);
  response = await send("/api/lineups", "GET", undefined, true);
  assert.ok((await response.json()).lineups.some((item) => item.id === lineup.id));
  response = await send("/api/lineups");
  assert.deepEqual((await response.json()).lineups, []);
  response = await send(`/api/lineups/${lineup.id}`);
  view = await response.json();
  assert.equal(view.canEdit, false);
  assert.ok(view.lineup.sundays.length >= 4);
  assert.ok(view.lineup.sundays.every((sunday) => sunday.date.startsWith(month)));
  const sunday = view.lineup.sundays[0].date;
  const path = `/api/lineups/${lineup.id}`;
  response = await send(path, "PATCH", { sunday, slot: "worship1", songId: duplicate.song.id }, true);
  assert.equal(response.status, 200);
  view = await response.json();
  assert.equal(view.lineup.sundays[0].slots.worship1.id, duplicate.song.id);
  assert.equal("owner_hash" in view.lineup, false);
  response = await send(path, "PATCH", { sunday, slot: "singspiration", songId: duplicate.song.id }, true);
  assert.equal(response.status, 400);
  response = await send(path, "PATCH", { sunday, slot: "closing", songId: data.song.id }, true);
  assert.equal(response.status, 200);
  response = await send(path, "PATCH", { sunday, slot: "closing", songId: null });
  assert.equal(response.status, 403);
  response = await send(path, "PATCH", { sunday: "2099-03-01", slot: "closing", songId: null }, true);
  assert.equal(response.status, 400);
  response = await send(path, "PATCH", { sunday, slot: "closing", songId: crypto.randomUUID() }, true);
  assert.equal(response.status, 404);
  response = await send(`/api/songs/${duplicate.song.slug}`, "DELETE", undefined, true);
  assert.equal(response.status, 409);
  response = await send(path, "PATCH", { sunday, slot: "worship1", songId: null }, true);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).lineup.sundays[0].slots.worship1, null);

  response = await send("/api/lineups", "POST", { month });
  assert.equal(response.status, 201);
  const otherCookie = response.headers.get("set-cookie").split(";")[0];
  const other = (await response.json()).lineup;
  lineups.push({ id: other.id, owner: otherCookie });
  assert.notEqual(other.id, lineup.id);
  response = await send(`/api/lineups/${other.id}`, "PATCH", { sunday, slot: "worship2", songId: reserved.song.id }, otherCookie);
  assert.equal(response.status, 200);
  response = await send(`/api/songs/${reserved.song.slug}`, "DELETE", undefined, true);
  assert.equal(response.status, 200);
  created.splice(created.indexOf(reserved.song.slug), 1);
  response = await send(`/api/lineups/${other.id}`);
  assert.deepEqual((await response.json()).lineup.sundays[0].slots.worship2, { removed: true });

  response = await send(path, "DELETE");
  assert.equal(response.status, 403);
  response = await send("/api/lineups/not-a-lineup");
  assert.equal(response.status, 404);
  console.log(
    "PASS: lineup create/reuse, owner-only changes, category and month validation, song delete guard, removed songs.",
  );
} finally {
  for (const { id, owner } of lineups) {
    const r = await send(`/api/lineups/${id}`, "DELETE", undefined, owner);
    assert.equal(r.status, 200);
    assert.equal((await send(`/api/lineups/${id}`)).status, 404);
  }
  for (const slug of created) {
    const r = await send(`/api/songs/${slug}`, "DELETE", undefined, true);
    assert.equal(r.status, 200);
    assert.equal((await send(`/api/songs/${slug}`)).status, 404);
  }
  console.log("QA records cleaned up; deletion and 404 verified.");
}
