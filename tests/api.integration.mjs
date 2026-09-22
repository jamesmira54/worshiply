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
let cookie = "";
async function send(path, method = "GET", body, owner = false, origin = base) {
  return fetch(base + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(owner ? { cookie } : {}),
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
    { ...input, title: title + " updated", defaultKey: "Eb" },
    true,
  );
  assert.equal(response.status, 200);
  response = await send(
    `/api/songs?search=${encodeURIComponent(title)}&key=Eb&sort=title`,
  );
  let results = await response.json();
  assert.equal(results.total, 1);
  assert.equal(results.songs[0].defaultKey, "Eb");
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
} finally {
  for (const slug of created) {
    const r = await send(`/api/songs/${slug}`, "DELETE", undefined, true);
    assert.equal(r.status, 200);
    assert.equal((await send(`/api/songs/${slug}`)).status, 404);
  }
  console.log("QA records cleaned up; deletion and 404 verified.");
}
