# Feature: Accounts

**From build-plan:** feature 12
**Build attempt:** 1
**Branch:** feature/accounts
**Status:** verified

## Goal

Replace browser-cookie ownership with real sign-in and two roles. A single
**admin** (set up from environment variables) has full access: songs, lineups,
and user management. Admin-created **users** can see everything, including
monthly lineups, but cannot change anything. Anonymous visitors can still read
songs exactly as they do today.

## In scope

- Access model (decided with the user on 2026-11-03):

  | Capability | Anonymous | User | Admin |
  |---|---|---|---|
  | Song library, song view, transpose, chord diagrams, share, print, PDF/Word export | yes | yes | yes |
  | View monthly lineups (`/lineups`, `/lineups/[id]`, `GET /api/lineups*`) | no (sign in) | yes | yes |
  | Create, edit, copy, delete songs | no | no | yes |
  | Create lineups, assign slots, delete lineups | no | no | yes |
  | Manage users (`/users`, `/api/users*`) | no | no | yes |

- Admin account created or updated from `ADMIN_USERNAME` and `ADMIN_PASSWORD`
  when the database initializes. No setup page, no public sign-up.
- Sign-in page, sign-out, and a header that reflects who is signed in.
- Admin-only Users page: add a user (username + password), reset a user's
  password, remove a user.
- Data migration: every existing song and lineup becomes admin-managed. Lineups
  become one per month; where a month has several, keep the most recently
  updated one and delete the others with their slots.
- Remove the `worshiply_owner` cookie logic entirely (no longer read or set).
- Brute-force protection on sign-in (per-username lockout, stored in the database).

## Out of scope

- Making song reading private (public reading stays).
- Open sign-up, email, password recovery, OAuth, self-service password change.
- More than one admin, or promoting users to admin.
- Per-user song ownership, setlists (feature 13), performance mode (feature 14).
- Song-creation rate limiting beyond what admin-only creation already gives.

## Build loop

`workflow.stepReview` is `feature`: build all steps, then present one review
packet for the whole feature. `workflow.checkpointCommits` is `disabled`: no
step commits. `/complete` makes the single feature commit.

## Build steps

- [x] **1. Auth core (server).** Add `lib/server/auth.ts` (`server-only`) with
  password hashing, session create/lookup/delete, and `currentUser(request)`.
  Put pure helpers (`hashPassword`, `verifyPassword`, `validateUsername`,
  `validatePassword`) in `lib/server/passwords.ts` without `server-only` so they
  can be unit tested. Extend `initialize()` in `lib/server/db.ts` with the
  `users` and `sessions` tables and the env admin upsert (see Data / contracts).
  **Done when:** `npm test` passes new tests in `lib/server/passwords.test.ts`
  (hash round-trip, wrong password fails, distinct salts, malformed stored hash
  fails closed, username and password rules); `npm run typecheck` passes.

- [x] **2. Sign-in and sign-out API.** `POST /api/auth/sign-in` and
  `POST /api/auth/sign-out` route handlers, with lockout and the session cookie.
  **Done when:** typecheck passes; with the dev server running, signing in with
  the env admin returns 200 and sets `worshiply_session`, a wrong password
  returns 401 with the generic message, the 6th consecutive bad attempt returns
  429, and sign-out clears the cookie and deletes the session row.

- [x] **3. Role checks on songs and lineups + migration.** Replace every
  `ownerToken` use in `app/api/songs*`, `app/api/lineups*` and `lib/server/db.ts`
  with `currentUser`. Song and lineup mutations require admin; lineup reads
  require any signed-in account. Run the lineup de-duplication migration and
  switch lineups to one per month. Remove `OWNER_COOKIE`, `ownerToken`,
  `setOwnerCookie`, `newOwnerToken`, `ownerHash` once unused.
  **Done when:** typecheck and `npm test` pass; anonymous `POST /api/songs`
  returns 401, user `PATCH` returns 403, admin create/edit/delete works;
  anonymous `GET /api/lineups` returns 401, user gets 200 with `canEdit: false`.

- [x] **4. Users API.** `GET/POST /api/users` and `PATCH/DELETE /api/users/[id]`,
  admin only.
  **Done when:** typecheck passes; admin can list, create (duplicate username →
  409), reset password (the user's sessions are removed), and delete a user; the
  admin row cannot be changed or deleted through this API (403/404); user and
  anonymous calls get 403/401.

- [x] **5. Sign-in page and header.** `/sign-in` page; root layout resolves the
  current account server-side and passes `{ username, role } | null` to
  `AppHeader`. Header shows Editor only for admin, Users only for admin,
  Lineups for any signed-in account, and a Sign in / Sign out control.
  **Done when:** typecheck passes; signing in from `/sign-in?next=/lineups`
  lands on `/lineups`; an off-site `next` value falls back to `/songs`; the
  header updates after sign-in and sign-out without a manual reload.

- [x] **6. Page gating and read-only UI.** `/songs/new` and
  `/songs/[slug]/edit`: anonymous → redirect to `/sign-in?next=<path>`, user →
  "Only the admin can edit songs." message with a link back. `/lineups` and
  `/lineups/[id]`: anonymous → redirect to sign-in. Song page and library hide
  Edit, Make a copy, and Delete for non-admins. Lineup pages show read-only
  view for users. Replace the old "browser that created it" copy everywhere.
  **Done when:** typecheck passes; as anonymous, user, and admin, each of these
  pages shows the behavior above (checked manually in the running app).

- [x] **7. Users page.** Admin-only `/users` page: list (username, role,
  created date), add-user form, reset-password form, remove with
  `ConfirmDialog`. Non-admins: anonymous → sign-in redirect, user → "Only the
  admin can manage users."
  **Done when:** typecheck passes; admin can add, reset, and remove a user in
  the running app, with field errors shown next to the inputs and announced.

- [x] **8. Integration test, env and docs.** Update `tests/api.integration.mjs`
  to sign in as the env admin (reads `ADMIN_USERNAME` / `ADMIN_PASSWORD` from
  the process env and fails with a clear message if unset), create a temporary
  user, and assert the anonymous/user/admin matrix above; it deletes its
  temporary songs, lineups and user. Update `.env.example`, `README.md`, and the
  Commands note in `AGENTS.md` for `npm run test:api`.
  **Done when:** `npm run typecheck`, `npm test`, `npm run build` pass and
  `npm run test:api` passes against the dev server with admin env set.

- [x] **9. Independent review repairs (F-01 to F-06).** F-01: `safeNext`
  resolves `next` against a fixed origin and keeps only same-origin paths, so
  tab/newline/backslash tricks fall back to `/songs`. F-02: sign-in reserves an
  attempt with a conditional update before checking the password, so parallel
  guesses cannot exceed the limit. F-03: restore "Make a copy" on the song page
  for the admin. F-04: sign-in also deletes expired sessions. F-05: wrap
  `pageAccount` in React `cache()` so one request does one session lookup.
  F-06: shared body and error helpers use generic, not song-specific, messages.
  **Done when:** typecheck, `npm test` (with new `safeNext` cases for tab and
  newline), `npm run build`, and `npm run test:api` pass; findings marked `fixed`.

- [x] **10. Second review repairs (F-01, F-07).** F-01: `safeNext` also falls
  back to `/songs` when the resolved path starts with `//`, so dot segments such
  as `/..//evil.example` cannot produce a protocol-relative redirect. F-07: the
  attempt reservation sets the lock in the same update that records the 5th
  failure, and an attempt after an expired lock starts a fresh count, so an
  interrupted request can never leave the counter stuck without a lock.
  **Done when:** typecheck, `npm test` (with dot-segment `safeNext` cases),
  `npm run build`, and `npm run test:api` pass; a live burst of 10 wrong
  passwords gives 5×401 then 429; `/sign-in?next=/..//evil.example` for a
  signed-in visitor redirects to `/songs`; F-01 and F-07 marked `fixed`.

## Files / areas

- New: `lib/server/auth.ts`, `lib/server/passwords.ts`,
  `lib/server/passwords.test.ts`, `app/api/auth/sign-in/route.ts`,
  `app/api/auth/sign-out/route.ts`, `app/api/users/route.ts`,
  `app/api/users/[id]/route.ts`, `app/sign-in/page.tsx`, `app/users/page.tsx`,
  `components/SignInForm.tsx`, `components/UserManager.tsx`, `types/user.ts`
- Changed: `lib/server/db.ts`, `lib/server/http.ts`, `app/api/songs/route.ts`,
  `app/api/songs/[slug]/route.ts`, `app/api/lineups/route.ts`,
  `app/api/lineups/[id]/route.ts`, `app/layout.tsx`, `components/AppHeader.tsx`,
  `components/SongPage.tsx`, `components/SongLibrary.tsx`,
  `components/editor/SongEditor.tsx`, `components/lineups/LineupList.tsx`,
  `components/lineups/LineupPage.tsx`, `app/songs/new/page.tsx`,
  `app/songs/[slug]/edit/page.tsx`, `app/lineups/page.tsx`,
  `app/lineups/[id]/page.tsx`, `package.json` (test script list),
  `tests/api.integration.mjs`, `.env.example`, `README.md`, `AGENTS.md`

## Data / contracts

**Tables** (created in `initialize()` with `IF NOT EXISTS`; no migration tool exists):

- `users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','user')),
  failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until TEXT,
  created_at TEXT NOT NULL)`. `id` is `randomUUID()`.
- `sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL)`, index on `user_id`. Foreign-key cascades are not
  relied on (existing code deletes child rows explicitly); delete sessions
  explicitly when a user is removed or their password changes.

**Passwords:** Node `crypto.scrypt`, 16-byte random salt, 64-byte key, stored as
`scrypt$<saltHex>$<keyHex>`; compare with `timingSafeEqual`. Any unparseable
stored value verifies as false. For an unknown username, still run one scrypt
against a fixed dummy hash so response time does not reveal existence.

**Validation:** username 3–40 chars, `^[a-z0-9._-]+$` after lowercasing and
trimming; stored lowercase. Password 10–200 chars, not trimmed.

**Env admin:** if `ADMIN_USERNAME` and `ADMIN_PASSWORD` are both set and valid,
upsert that username with role `admin`. If the stored hash does not verify
against the env password, rehash and delete that admin's sessions. Delete any
other `role = 'admin'` row (and its sessions), so renaming the env admin leaves
exactly one admin. If an existing `user` row has the admin username, promote it.
If the env vars are missing or invalid, log a warning (no secret values) and
continue: the app stays readable but nobody can sign in as admin. Never log
passwords or hashes.

**Session cookie:** `worshiply_session`, 32 random bytes hex; only its SHA-256
is stored. HTTP-only, `secure` on https, `sameSite: "lax"`, path `/`, 30-day
`maxAge` matching `expires_at`. Lookup ignores and deletes expired rows. No
sliding renewal.

**Lockout:** each failed sign-in for an existing username increments
`failed_attempts`; at 5 set `locked_until` = now + 15 minutes and reset the
counter. While locked, return 429 without checking the password. Success
resets both fields.

**API results** (all JSON, `Cache-Control: private, no-store` on reads, errors
keep the existing `{ error: string }` shape via `apiError`):

- `POST /api/auth/sign-in` body `{ username, password }` → 200
  `{ user: { username, role } }` + cookie; 400 invalid body; 401
  "Incorrect username or password."; 429 "Too many attempts. Try again in 15 minutes."
- `POST /api/auth/sign-out` → 200 `{ success: true }`, cookie cleared; works
  when already signed out.
- `GET /api/users` → `{ users: [{ id, username, role, createdAt }] }`.
- `POST /api/users` `{ username, password }` → 201 `{ user }`; 409 "That username is taken."
- `PATCH /api/users/[id]` `{ password }` → 200 `{ user }`.
- `DELETE /api/users/[id]` → 200 `{ success: true }`.
- Shared denial messages: 401 "Sign in to continue." and 403 "Only the admin can make changes."
- Existing song and lineup responses keep their shapes; `canEdit` now means
  "current account is admin".
- All POST/PATCH/DELETE keep `checkOrigin` (via `readBody` or directly),
  including sign-in and sign-out.

**Songs:** `owner_hash` column stays (NOT NULL, cannot be dropped safely);
new rows store `''` and the column is no longer read. Deleting a song is
blocked (409) if it is in **any** lineup.

**Lineup migration** (in `initialize()`, idempotent, in one write batch, in this order):

1. Delete `lineup_slots` rows whose lineup is not the keeper for its month.
2. Delete those non-keeper `lineups` rows. Keeper = highest `updated_at`, ties
   broken by highest `id`.
3. `CREATE UNIQUE INDEX IF NOT EXISTS lineups_month ON lineups(month)`.

New lineups store `owner_hash = ''` and use `ON CONFLICT (month) DO NOTHING`;
all lineup queries drop the `owner_hash` filter. This deletes data on first
startup after deploy, which the user approved.

**Redirects:** `next` is honored only if it starts with `/` and not `//` or
`/\`; otherwise `/songs`.

## Testing

- Unit: `lib/server/passwords.test.ts`, added to the explicit file list in
  the `test` script.
- Integration: `npm run test:api` (step 8) needs the dev server and admin env.
- Manual: anonymous / user / admin walk-through from step 6 and 7 done-whens.
- No Verify command or browser test harness exists, so none is claimed.

## Notes for the AI

- Next.js 16: read `node_modules/next/dist/docs/` for route handlers,
  `cookies()`, `redirect()`, and dynamic rendering before steps 2, 5, and 6.
  Gate in pages and route handlers; do not add a `proxy`/middleware layer.
- No new dependencies: `node:crypto` covers hashing and tokens.
- Render usernames as React text only (never HTML).
- Form errors: label each input, tie errors with `aria-describedby`, announce
  with `role="alert"`, move focus to the first invalid field, clear on edit.
- Loading and error states on the Users page reuse the existing library and
  lineup patterns.
- The app reads `ADMIN_*` only on the server; never expose them to the client.
- Assumption to confirm in review: users see lineups, anonymous visitors do
  not (lineups are private today). That is what gives a user account more
  access than an anonymous visitor.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":14686,"specSha256":"5b3335da48d1933890e063e756f3aa01b6938a3dd638447f932407d6a89d7541","branch":"refs/heads/feature/accounts","head":"ad9e483accbe922a7b9f1a7e7196f25977445dae","baseRef":"refs/heads/main","baseCommit":"2558f64c224a2231504b27720e32d930d86a3dc3","sourceTree":"0ee14a91a2734cd245ca47d1e551244cd326a9a4","absentOptional":[]} -->

## Findings

### 12/F-01 [P1] closed - Sign-in `next` allows an off-site redirect through tab or newline characters

**File:** lib/server/passwords.ts:61
**Found:** 2026-11-03 by /audit independent (scope: current; lens: security)
**Why it matters:** `safeNext` checks only the raw string prefix. The WHATWG URL parser strips ASCII tab and newline before resolving, so `/sign-in?next=/%09/evil.example` decodes to `"/\t/evil.example"`, passes all three checks, and resolves to `http://evil.example/` (verified with `new URL("/\t/evil.example", "http://localhost:3000")`). The value reaches `router.replace(next)` in `components/SignInForm.tsx:23`, where Next's app router marks the resolved URL external and performs a hard navigation off-site (`app-router-instance.js` `isExternalURL` -> `completeHardNavigation`), and also `redirect(next)` in `app/sign-in/page.tsx:15` for an already-signed-in visitor. This breaks the spec contract "an off-site `next` value falls back to `/songs`" and gives a phishing redirect right after a real sign-in.
**Suggested fix:** Resolve the value against a fixed dummy origin (`new URL(value, "http://local.invalid")`), require the resulting origin to equal that dummy origin, and return `pathname + search + hash`; or reject any value containing control characters (`\x00-\x1f`) or a backslash anywhere. Add `"/\t/evil.example"` and `"/\n/evil.example"` to the `safeNext` unit test.
**Resolution:** Fixed 2026-11-03: `safeNext` resolves against a fixed origin and keeps only same-origin path+search+hash. Unit tests cover `//`, `/\`, tab, LF, CR/LF; live `/sign-in?next=/%09/evil.example` while signed in → 307 to `/songs`.
Reopened 2026-11-03 by /audit independent (fresh subagent): the repair blocks the tab, newline, and backslash vectors but not dot segments. `safeNext` returns `url.pathname`, and URL path normalization turns `/..//evil.example`, `/.//evil.example`, `/a/..//evil.example`, and `/%2e%2e//evil.example` into the pathname `//evil.example`, which is returned unchanged (verified with a `node -e` copy of `safeNext`; `new URL("//evil.example", "http://localhost:3000/sign-in").href` is `http://evil.example/`). The value still reaches `redirect(next)` in `app/sign-in/page.tsx:15` and `router.replace(next)` in `components/SignInForm.tsx:23`, so `/sign-in?next=/..//evil.example` is still an off-site redirect after sign-in. The unit test at `lib/server/passwords.test.ts:43` has no dot-segment case. Suggested repair: after resolving, also fall back to `/songs` when the resulting `pathname` starts with `//`, and add the four dot-segment cases above to the test.
Fixed again 2026-11-05: `safeNext` also falls back to `/songs` when the resolved pathname starts with `//`. Unit test adds `/..//`, `/.//`, `/a/..//`, `/%2e%2e//`, and `/songs/../..//` cases (`npm test` 23/23). Live: signed-in `/sign-in?next=/..//evil.example` (encoded and unencoded) → 307 to `/songs`.
Closed 2026-11-05 by /audit independent (fresh subagent): lib/server/passwords.ts:57-68 resolves against a fixed origin and rejects a resolved pathname starting with `//`. A `node -e` copy of `safeNext` returned `/songs` or a same-origin path for tab/LF/CR, `//`, `/\`, `/..//`, `/.//`, `/%2e%2e//`, `/.%2e//`, `/x/../\t/` and kept encoded `%2f%2f` / `%5c%5c` paths encoded; every output re-resolved against `http://localhost:3000` stayed on that host. Both sinks (`app/sign-in/page.tsx:15`, `components/SignInForm.tsx:23`) receive only the `safeNext` result. Unit test covers the dot-segment cases (`npm test` 23/23). No new defect.

### 12/F-02 [P2] closed - Lockout is check-then-act, so concurrent attempts bypass the 5-attempt limit

**File:** lib/server/auth.ts:86
**Found:** 2026-11-03 by /audit independent (scope: current; lens: security)
**Why it matters:** `signIn` reads `locked_until`, then awaits scrypt, then increments `failed_attempts`. Every request that reads the row before the fifth failure is recorded gets a full password check, so a burst of N parallel requests at the start of each 15-minute window yields N guesses instead of 5. The atomic UPDATE keeps the counter consistent but does not stop in-flight guesses. The 10-character minimum and scrypt cost limit the practical impact, so this is a weakened control rather than an open door.
**Suggested fix:** Reserve the attempt before verifying: one conditional `UPDATE users SET failed_attempts = failed_attempts + 1 ... WHERE id = ? AND (locked_until IS NULL OR locked_until <= ?) RETURNING failed_attempts` (lock when it reaches 5), treat zero affected rows as 429, and reset on success. No new dependency needed.
**Resolution:** Fixed 2026-11-03: sign-in reserves the attempt with `UPDATE ... WHERE locked_until IS NULL OR locked_until <= ? RETURNING failed_attempts` before scrypt; attempts beyond 5 get 429 without a password check, and the 5th failure sets the lock. Live burst of 10 parallel wrong passwords → 5×401, 5×429; correct password afterwards → 429. `npm run test:api` lockout section passes.
Re-reviewed 2026-11-03 by /audit independent (fresh subagent): the conditional `UPDATE ... RETURNING` reservation at lib/server/auth.ts:90-95 does cap parallel guesses at 5 per window. Kept `fixed`, not closed, because the repair introduces F-07 (the counter can stick above the limit with no lock set).
Closed 2026-11-05 by /audit independent (fresh subagent): lib/server/auth.ts:93-103 reserves the attempt in one conditional `UPDATE ... RETURNING` before scrypt, and only rows not currently locked are updated, so at most 5 password checks run per window regardless of parallelism. The F-07 follow-up issue is repaired in the same statement (see F-07). No new defect.

### 12/F-03 [P3] closed - Admin lost the "Make a copy" action on the song page

**File:** components/SongPage.tsx:71
**Found:** 2026-11-03 by /audit independent (scope: current; lens: quality)
**Why it matters:** The spec says the song page hides Edit, Make a copy, and Delete *for non-admins*, and admins keep "copy". The diff deleted the `duplicate()` handler and button entirely, so the admin can now copy only from the library's Duplicate action. Small spec drift and a lost shortcut.
**Suggested fix:** Restore the Make a copy button behind `canEdit`, or record the removal as an intentional spec change.
**Resolution:** Fixed 2026-11-03: "Make a copy" restored on the song page beside "Edit song", shown only when `canEdit` (admin).
Closed 2026-11-03 by /audit independent (fresh subagent): components/SongPage.tsx:91-104 renders Make a copy and Edit song only inside `canEdit`, which comes from the API `canEdit` (admin only). No new defect.

### 12/F-04 [P3] closed - Expired sessions are never purged unless their cookie is presented again

**File:** lib/server/auth.ts:35
**Found:** 2026-11-03 by /audit independent (scope: current; lens: performance)
**Why it matters:** Expired rows are deleted only when the same token is looked up. Sessions from cleared browsers or abandoned devices stay in the `sessions` table forever, so it grows without bound (slowly, for a church-team app).
**Suggested fix:** Add `DELETE FROM sessions WHERE expires_at <= ?` to the sign-in write batch (or to `initialize()`); no scheduler needed.
**Resolution:** Fixed 2026-11-03: the sign-in write batch also runs `DELETE FROM sessions WHERE expires_at <= ?`.
Closed 2026-11-03 by /audit independent (fresh subagent): lib/server/auth.ts:117 deletes expired sessions in the same write batch as the new session insert; the new row expires 30 days out, so that statement never removes it. No new defect.

### 12/F-05 [P3] closed - Session lookup runs twice per page request and makes every page dynamic

**File:** lib/server/auth.ts:48
**Found:** 2026-11-03 by /audit independent (scope: current; lens: performance)
**Why it matters:** The root layout and the gated pages (`/songs`, `/lineups`, `/users`, `/sign-in`, editor pages) each call `pageAccount()`, so one navigation runs the session JOIN twice. Reading `cookies()` in the root layout also makes `/` and `/_not-found` dynamic (build output shows every route as dynamic).
**Suggested fix:** Wrap `pageAccount` in React's `cache()` so a request does one lookup. Accept the dynamic layout as the cost of the server-rendered header, or note it.
**Resolution:** Fixed 2026-11-03: `pageAccount` wrapped in React `cache()`, so layout and page share one lookup per request. The dynamic layout is the accepted cost of the server-rendered header.
Closed 2026-11-03 by /audit independent (fresh subagent): lib/server/auth.ts:49 wraps `pageAccount` in React `cache()`; it is called only from server components (layout and pages), while route handlers use `currentUser(request)`. Storage errors still fall back to the signed-out view. No new defect.

### 12/F-06 [P3] closed - Shared body and error helpers still use song-specific messages for auth and user endpoints

**File:** lib/server/http.ts:61
**Found:** 2026-11-03 by /audit independent (scope: current; lens: quality)
**Why it matters:** `readBody` and `apiError` now serve sign-in, users, and lineups, but still say "Send the song as JSON.", "This song is too large.", "The song contains invalid JSON." (lines 61-82), and log "Song API operation failed" (line 91). A malformed sign-in or add-user request shows a confusing song message.
**Suggested fix:** Make the messages generic ("Send the request as JSON.", "This request is too large.") or pass a noun in from the caller.
**Resolution:** Fixed 2026-11-03: `readBody` and `apiError` messages are generic ("Send the request as JSON.", "This request is too large.", "API operation failed").
Closed 2026-11-03 by /audit independent (fresh subagent): lib/server/http.ts:58-97 messages are generic; no song-specific text remains in the shared helpers. No new defect.

### 12/F-07 [P3] closed - Sign-in lockout can stick permanently when the fifth failed attempt does not finish

**File:** lib/server/auth.ts:94
**Found:** 2026-11-03 by /audit independent (scope: current; lens: security)
**Why it matters:** The attempt reservation increments `failed_attempts` first, and only the request that reserved attempt 5 later sets `locked_until` and resets the counter (lines 96-101). If that request never reaches the lock update (a scrypt or database error, or a process restart or redeploy mid-request), the row is left with `failed_attempts >= 5` and `locked_until` NULL. Every later attempt then reserves 6, 7, ... and gets 429 forever, with no 15-minute expiry. A user can be recovered by an admin password reset, but the env admin cannot: `syncAdmin` in lib/server/db.ts returns early when the stored hash already matches (`if (current && row.role === "admin") return;`), so it never clears the counter.
**Suggested fix:** Set the lock atomically in the reservation itself, for example `failed_attempts = failed_attempts + 1, locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN <now + 15 min> ELSE locked_until END`, keep the success path clearing both fields, and reset the counter once a lock is set or has expired. No new dependency needed.
**Resolution:** Fixed 2026-11-05: the reservation `UPDATE` sets `failed_attempts = CASE WHEN locked_until IS NOT NULL THEN 1 ELSE failed_attempts + 1 END` and, in the same statement, `locked_until = now + 15 min` when that count reaches 5 (otherwise NULL). No separate lock write remains, so an interrupted 5th attempt still leaves the row locked with an expiry, and the first attempt after an expired lock starts again at 1 (this also clears any row left stuck by the old code). Zero returned rows → 429; success clears both fields. Live burst of 10 parallel wrong passwords → 5×401, 5×429; correct password afterwards → 429; `npm run test:api` lockout section passes.
Closed 2026-11-05 by /audit independent (fresh subagent): the lock is set by the same statement that records the 5th attempt (lib/server/auth.ts:93-95; SQLite evaluates both `SET` expressions against the pre-update row). Running the exact reservation SQL against an in-memory libsql database gave counts 1-4 with no lock, 5 with the lock, then zero rows (429) while locked, and 1 with no lock after expiry. A row left stuck by the old code (count 7, no lock) gets one attempt that sets a normal 15-minute lock, then restarts at 1, so it can no longer stick permanently (slightly different from "starts again at 1" immediately, but bounded). No new defect.

## Independent review

**Status:** passed
**Target commit:** ad9e483accbe922a7b9f1a7e7196f25977445dae
**Base commit:** 2558f64c224a2231504b27720e32d930d86a3dc3
**Base ref:** main
**Spec hash:** 5b3335da48d1933890e063e756f3aa01b6938a3dd638447f932407d6a89d7541
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-11-05T00:52:21Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-11-05T00:55:25Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `2558f64c224a2231504b27720e32d930d86a3dc3..ad9e483accbe922a7b9f1a7e7196f25977445dae` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `npm run typecheck`: pass
- `npm test`: pass (23/23)
- `npm run build`: pass (Next.js 16.3.5; all routes dynamic); `next-env.d.ts` restored with `git checkout` afterwards
- `npm run test:api`: unavailable (needs admin credentials and a running dev server; not run by this reviewer)
- `node` probe of a copy of `safeNext` with redirect vectors: pass (every output stays same-origin)
- `node` probe of the lineup migration and lockout reservation SQL on an in-memory libsql database: pass

### Evidence

- Freshness: `HEAD` = target, `git merge-base main HEAD` = base, raw SHA-256 of `blueprint/context/current-feature.md` matches, only `blueprint/context/review.md` differed from the target before review.
- Reviewed the full 39-file `2558f64..ad9e483` delta: `lib/server/{auth,passwords,http,db}.ts`, all `app/api/{auth,songs,lineups,users}` route handlers, gated pages (`/sign-in`, `/users`, `/songs`, `/songs/new`, `/songs/[slug]/edit`, `/lineups`, `/lineups/[id]`), `app/layout.tsx`, `AppHeader`, `SignInForm`, `UserManager`, `AccessNotice`, `SongPage`, `SongLibrary`, `LineupList`, `SongEditor`, tests, `package.json`, `.env.example`, `README.md`, `AGENTS.md`.
- Every mutation calls `requireAdmin` with a role read from the database per request and keeps `checkOrigin`; lineup reads require an account; users API refuses the admin row (403) and unknown ids (404); no `owner_hash`, `worshiply_owner`, or "browser that created" logic remains in app code.
- Session tokens are 32 random bytes, stored as SHA-256, cookie HTTP-only, `sameSite: lax`, `secure` on https; expired rows deleted on lookup and on sign-in; password reset and user removal delete sessions.
- Lockout SQL probe: attempts 1-4 unlocked, 5th sets a 15-minute lock, then 0 rows (429) while locked, restart at 1 after expiry; legacy stuck row recovers after one bounded lock.
- Migration probe: keeps newest `updated_at` per month with ties broken by highest `id`, deletes the other lineups and their slots, idempotent on a second run, unique `lineups_month` index created.
- Ledger: F-01, F-02, F-07 re-reviewed and closed; F-08 added.

### Findings

- F-01 [P1] closed
- F-02 [P2] closed
- F-07 [P3] closed
- F-08 [P3] open (tests: lockout expiry and lineup migration lack automated coverage)

### Remaining risk

- `npm run test:api` was unavailable to this reviewer (admin credentials and a running dev server required); live API behavior relies on the builder's recorded runs.
- No browser harness: page gating, header updates, and Users page accessibility were reviewed in code only, not exercised in a browser.
- `syncAdmin` makes the environment the source of truth: any deployment that shares the database but has missing or different `ADMIN_*` values removes or replaces the admin row (README already advises a separate Preview database).
- Per-username lockout lets anyone who knows a username lock that account for 15 minutes (accepted by the spec design).
