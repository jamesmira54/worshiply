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
