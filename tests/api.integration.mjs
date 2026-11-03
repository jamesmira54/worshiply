import assert from "node:assert/strict";
const base = "http://localhost:3000";
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminUsername || !adminPassword) {
  console.error(
    "Set ADMIN_USERNAME and ADMIN_PASSWORD to the admin credentials the dev server uses, then rerun npm run test:api.",
  );
  process.exit(1);
}
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
const qaUser = { username: `qa-user-${Date.now()}`, password: "qa-password-1" };
let qaUserId = "";
let admin = "";
async function send(path, method = "GET", body, cookie = "", origin = base) {
  return fetch(base + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(method !== "GET" ? { origin } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function signIn(username, password) {
  const response = await send("/api/auth/sign-in", "POST", { username, password });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}
try {
  let response = await send("/api/auth/sign-in", "POST", {
    username: adminUsername,
    password: adminPassword + "x",
  });
  assert.equal(response.status, 401);
  admin = await signIn(adminUsername, adminPassword);
  response = await send("/api/users", "POST", qaUser, admin);
  assert.equal(response.status, 201);
  qaUserId = (await response.json()).user.id;
  response = await send("/api/users", "POST", qaUser, admin);
  assert.equal(response.status, 409);
  response = await send("/api/users", "POST", { username: "x", password: "short" }, admin);
  assert.equal(response.status, 400);
  let user = await signIn(qaUser.username, qaUser.password);
  console.log("PASS: admin sign-in, wrong password, user creation, duplicate and invalid users.");

  response = await send("/api/songs", "POST", input);
  assert.equal(response.status, 401);
  response = await send("/api/songs", "POST", input, user);
  assert.equal(response.status, 403);
  response = await send("/api/songs", "POST", input, admin);
  assert.equal(response.status, 201);
  let data = await response.json();
  created.push(data.song.slug);
  assert.equal(data.canEdit, true);
  assert.equal(data.song.category, "Praise & Worship");
  assert.match(data.song.slug, /^worshiply-api-check-\d+$/);
  response = await send("/api/songs", "POST", input, admin);
  assert.equal(response.status, 201);
  let duplicate = await response.json();
  created.push(duplicate.song.slug);
  assert.equal(duplicate.song.slug, data.song.slug + "-2");
  response = await send(`/api/songs/${data.song.slug}`);
  let view = await response.json();
  assert.equal(view.canEdit, false);
  assert.equal(view.song.defaultKey, "D");
  response = await send(`/api/songs/${data.song.slug}`, "GET", undefined, user);
  assert.equal((await response.json()).canEdit, false);
  response = await send(`/api/songs/${data.song.slug}`, "PATCH", { ...input, title: "Unauthorized" });
  assert.equal(response.status, 401);
  response = await send(`/api/songs/${data.song.slug}`, "PATCH", { ...input, title: "Unauthorized" }, user);
  assert.equal(response.status, 403);
  response = await send(`/api/songs/${data.song.slug}`, "DELETE");
  assert.equal(response.status, 401);
  response = await send(`/api/songs/${data.song.slug}`, "DELETE", undefined, user);
  assert.equal(response.status, 403);
  response = await send(`/api/songs/${data.song.slug}`, "PATCH", input, admin, "https://untrusted.invalid");
  assert.equal(response.status, 403);
  response = await send(
    `/api/songs/${data.song.slug}`,
    "PATCH",
    { ...input, title: title + " updated", defaultKey: "Eb", category: "Hymnal" },
    admin,
  );
  assert.equal(response.status, 200);
  response = await send(`/api/songs?search=${encodeURIComponent(title)}&key=Eb&sort=title`);
  let results = await response.json();
  assert.equal(results.total, 1);
  assert.equal(results.songs[0].defaultKey, "Eb");
  assert.equal(results.songs[0].canEdit, false);
  response = await send(`/api/songs?search=${encodeURIComponent(title)}&category=Hymnal`, "GET", undefined, admin);
  results = await response.json();
  assert.equal(results.total, 1);
  assert.equal(results.songs[0].category, "Hymnal");
  assert.equal(results.songs[0].canEdit, true);
  response = await send(`/api/songs?search=${encodeURIComponent(title)}&category=Singspiration`);
  assert.equal((await response.json()).total, 0);
  response = await send("/api/songs", "POST", { ...input, title: "" }, admin);
  assert.equal(response.status, 400);
  response = await send(`/api/songs/${data.song.slug}`, "GET", undefined, admin);
  view = await response.json();
  assert.equal(view.canEdit, true);
  assert.equal(view.song.title, title + " updated");
  response = await send("/api/songs", "POST", { ...input, title: "New" }, admin);
  assert.equal(response.status, 201);
  const reserved = await response.json();
  created.push(reserved.song.slug);
  assert.notEqual(reserved.song.slug, "new");
  assert.match(reserved.song.slug, /^new-song/);
  console.log(
    "PASS: admin-only song changes, public read, readable unique slugs, reserved routes, cross-origin rejection, saved-key search, validation.",
  );

  const month = "2099-02";
  response = await send("/api/lineups", "POST", { month }, user);
  assert.equal(response.status, 403);
  response = await send("/api/lineups", "POST", { month }, admin);
  assert.equal(response.status, 201);
  const lineup = (await response.json()).lineup;
  lineups.push(lineup.id);
  response = await send("/api/lineups", "POST", { month }, admin);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).lineup.id, lineup.id);
  response = await send("/api/lineups", "POST", { month: "2099-13" }, admin);
  assert.equal(response.status, 400);
  response = await send("/api/lineups");
  assert.equal(response.status, 401);
  response = await send("/api/lineups", "GET", undefined, user);
  assert.ok((await response.json()).lineups.some((item) => item.id === lineup.id));
  const path = `/api/lineups/${lineup.id}`;
  response = await send(path);
  assert.equal(response.status, 401);
  response = await send(path, "GET", undefined, user);
  view = await response.json();
  assert.equal(view.canEdit, false);
  assert.ok(view.lineup.sundays.length >= 4);
  assert.ok(view.lineup.sundays.every((sunday) => sunday.date.startsWith(month)));
  const sunday = view.lineup.sundays[0].date;
  response = await send(path, "PATCH", { sunday, slot: "worship1", songId: duplicate.song.id }, admin);
  assert.equal(response.status, 200);
  view = await response.json();
  assert.equal(view.canEdit, true);
  assert.equal(view.lineup.sundays[0].slots.worship1.id, duplicate.song.id);
  assert.equal("owner_hash" in view.lineup, false);
  response = await send(path, "PATCH", { sunday, slot: "singspiration", songId: duplicate.song.id }, admin);
  assert.equal(response.status, 400);
  response = await send(path, "PATCH", { sunday, slot: "closing", songId: data.song.id }, admin);
  assert.equal(response.status, 200);
  response = await send(path, "PATCH", { sunday, slot: "closing", songId: null });
  assert.equal(response.status, 401);
  response = await send(path, "PATCH", { sunday, slot: "closing", songId: null }, user);
  assert.equal(response.status, 403);
  response = await send(path, "PATCH", { sunday: "2099-03-01", slot: "closing", songId: null }, admin);
  assert.equal(response.status, 400);
  response = await send(path, "PATCH", { sunday, slot: "closing", songId: crypto.randomUUID() }, admin);
  assert.equal(response.status, 404);
  response = await send(`/api/songs/${duplicate.song.slug}`, "DELETE", undefined, admin);
  assert.equal(response.status, 409);
  response = await send(path, "PATCH", { sunday, slot: "worship1", songId: null }, admin);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).lineup.sundays[0].slots.worship1, null);
  response = await send(path, "DELETE", undefined, user);
  assert.equal(response.status, 403);
  response = await send("/api/lineups/not-a-lineup", "GET", undefined, user);
  assert.equal(response.status, 404);
  console.log(
    "PASS: shared lineup create/reuse, signed-in reads, admin-only changes, category and month validation, song delete guard.",
  );

  response = await send("/api/users");
  assert.equal(response.status, 401);
  response = await send("/api/users", "GET", undefined, user);
  assert.equal(response.status, 403);
  response = await send("/api/users", "GET", undefined, admin);
  const accounts = (await response.json()).users;
  assert.ok(accounts.some((item) => item.id === qaUserId && item.role === "user"));
  const adminRow = accounts.find((item) => item.role === "admin");
  assert.equal("password_hash" in adminRow, false);
  response = await send(`/api/users/${adminRow.id}`, "PATCH", { password: "another-password" }, admin);
  assert.equal(response.status, 403);
  response = await send(`/api/users/${adminRow.id}`, "DELETE", undefined, admin);
  assert.equal(response.status, 403);
  response = await send(`/api/users/${qaUserId}`, "PATCH", { password: "qa-password-2" }, user);
  assert.equal(response.status, 403);
  response = await send(`/api/users/${qaUserId}`, "PATCH", { password: "qa-password-2" }, admin);
  assert.equal(response.status, 200);
  response = await send("/api/lineups", "GET", undefined, user);
  assert.equal(response.status, 401);
  user = await signIn(qaUser.username, "qa-password-2");
  response = await send("/api/auth/sign-out", "POST", undefined, user);
  assert.equal(response.status, 200);
  response = await send("/api/lineups", "GET", undefined, user);
  assert.equal(response.status, 401);
  for (let attempt = 1; attempt <= 5; attempt++) {
    response = await send("/api/auth/sign-in", "POST", { username: qaUser.username, password: "wrong-password" });
    assert.equal(response.status, 401);
  }
  response = await send("/api/auth/sign-in", "POST", { username: qaUser.username, password: "qa-password-2" });
  assert.equal(response.status, 429);
  console.log("PASS: admin-only user management, protected admin row, password reset signs out, sign-out, lockout.");
} finally {
  for (const id of lineups) {
    const r = await send(`/api/lineups/${id}`, "DELETE", undefined, admin);
    assert.equal(r.status, 200);
    assert.equal((await send(`/api/lineups/${id}`, "GET", undefined, admin)).status, 404);
  }
  for (const slug of created) {
    const r = await send(`/api/songs/${slug}`, "DELETE", undefined, admin);
    assert.equal(r.status, 200);
    assert.equal((await send(`/api/songs/${slug}`)).status, 404);
  }
  if (qaUserId) {
    const r = await send(`/api/users/${qaUserId}`, "DELETE", undefined, admin);
    assert.equal(r.status, 200);
    assert.equal((await send(`/api/users/${qaUserId}`, "DELETE", undefined, admin)).status, 404);
  }
  if (admin) await send("/api/auth/sign-out", "POST", undefined, admin);
  console.log("QA records cleaned up; deletion and 404 verified.");
}
