# Feature: Monthly song lineup

**From build-plan:** feature 15
**Build attempt:** 1
**Branch:** feature/monthly-song-lineup
**Status:** verified

## Goal

A worship leader picks a month and assigns songs to every Sunday on the calendar
(4 or 5, by date). Each Sunday has four slots: one Singspiration, two Worship
songs, and one Closing song. Each browser owns its own lineups, the same way it
owns songs. Anyone with a lineup's link can view it. Only the creating browser
can change it.

## In scope

- One lineup per browser per month, created from a month picker. Creating a
  month that already exists for this browser opens the existing one.
- Every calendar Sunday of that month, each with four slots:
  - `singspiration` - only songs in the Singspiration category
  - `worship1`, `worship2` - only songs in the Praise & Worship category
  - `closing` - any song
- Slot pickers search saved songs and show only those allowed for the slot.
  The server enforces the same category rule.
- Assign, change, or clear one slot at a time. Empty slots are allowed.
- `/lineups` lists this browser's lineups, newest month first, plus the create form.
- `/lineups/[id]` shows the lineup. The owner sees pickers; everyone else sees
  read-only song links. A copy-link action is available to everyone.
- Owner-only lineup delete with confirmation (needed so mistakes and QA data can
  be removed; see Notes).
- Song delete is refused (409) when the song is used in any lineup owned by the
  deleting browser. In other browsers' lineups, the slot then shows "Song removed"
  and can be re-picked by that lineup's owner.
- "Lineups" link in the main navigation.
- Songs opened from a lineup link to `/songs/[slug]?lineup=<id>`. The song page's
  back link then reads "Monthly lineup" and returns to that lineup. Without a
  valid `lineup` id it stays "Song library" and goes to `/songs`. (Added at the
  user's request after the first verification.)

## Out of scope

- Printing or exporting a lineup (PDF, Word), per-slot key overrides, and
  transposing from the lineup. Feature 13 (Setlists) owns grouped export.
- Lineups for days other than Sunday, or slot counts other than four.
- Accounts, shared team ownership, or cross-device editing (feature 12).
- Listing other browsers' lineups. Lineups are reachable only by link.
- Automatic removal of an assigned song whose category later changes. The
  assignment stays, and the rule applies at assignment time only.

## Build loop

`workflow.stepReview` is `feature`: implement all steps, then present one
review packet. `workflow.checkpointCommits` is `disabled`, so there are no step
commits. `/complete` creates the feature commit. Run `npm test` and
`npm run typecheck` after each step. They must be green before review.

## Build steps

- [x] 1. **Lineup domain and validation.** Add `types/lineup.ts`, `lib/lineups.ts`
  (slot definitions and the `sundaysInMonth` calculation), and lineup validators
  in `lib/server/validation.ts`. Add `tests/lineups.test.ts` and append it to
  the `test` script in `package.json`.
  Done when: `npm test` runs the new file and passes. It must cover 4- and
  5-Sunday months, a month starting on Sunday, leap-year February, invalid
  months, slot keys, the category rules, and null clearing.
- [x] 2. **Storage and lineup API.** Create the `lineups` and `lineup_slots`
  tables in `initialize()`. Add the lineup data functions to `lib/server/db.ts`
  and add `app/api/lineups/route.ts` and `app/api/lineups/[id]/route.ts`.
  Done when: `npm run typecheck` passes, and the API returns the shapes in Data / contracts
  for create, list, get, assign, clear, and delete, including the 400, 403, 404,
  and 409 cases.
- [x] 3. **Song delete guard.** Make `deleteSong` refuse atomically when the song
  is in one of the caller's lineups. The library's existing delete error display
  shows the 409 message.
  Done when: deleting a song used in your own lineup shows the 409 message, and
  the song remains. Deleting it after clearing the slot succeeds.
- [x] 4. **Lineup screens.** Add `app/lineups/page.tsx` and
  `app/lineups/[id]/page.tsx` as thin wrappers, `components/lineups/LineupList.tsx`,
  `components/lineups/LineupPage.tsx`, and `components/lineups/SlotPicker.tsx`.
  Add the nav link in `components/AppHeader.tsx` and the styles in `app/globals.css`.
  Done when: in the dev server you can create a month, see every Sunday, assign
  and clear each slot type with category-filtered pickers, and view the lineup
  read-only from a different browser. Loading, empty, not-found, error, and
  removed-song states all render.
- [x] 5. **API integration checks.** Extend `tests/api.integration.mjs` to:
  - create a QA lineup and assign the QA song
  - check the category rejection, a foreign-cookie 403, and the delete-guard 409
  - clear the slot and delete the lineup before the existing song cleanup

  Done when: `npm run test:api` passes against the running dev server and leaves
  no QA lineups or songs behind.

- [x] 6. **Back link to the lineup.** `app/songs/[slug]/page.tsx` reads the
  `lineup` search param, accepts only a UUID, and passes it to `SongPage`, which
  switches the back link's target and label. Lineup slot links carry the param.
  Done when: `npm run typecheck` passes and a song page opened with
  `?lineup=<uuid>` renders a back link to `/lineups/<uuid>`, while one without
  it links to `/songs`.

## Files / areas

- New: `types/lineup.ts`, `lib/lineups.ts`, `tests/lineups.test.ts`,
  `app/api/lineups/route.ts`, `app/api/lineups/[id]/route.ts`,
  `app/lineups/page.tsx`, `app/lineups/[id]/page.tsx`, `components/lineups/*`
- Changed: `lib/server/db.ts` (tables, lineup functions, `deleteSong`),
  `lib/server/validation.ts`, `components/AppHeader.tsx`, `app/globals.css`,
  `package.json` (`test` script only), `tests/api.integration.mjs`,
  `app/songs/[slug]/page.tsx`, `components/SongPage.tsx`, `components/SongLibrary.tsx`,
  `lib/server/http.ts`, `app/api/songs/route.ts`

## Data / contracts

### Slots (`lib/lineups.ts`)

| Key | Label | Allowed category |
|---|---|---|
| `singspiration` | Singspiration | `Singspiration` |
| `worship1` | Worship song 1 | `Praise & Worship` |
| `worship2` | Worship song 2 | `Praise & Worship` |
| `closing` | Closing song | any |

A song's category is read as `COALESCE(json_extract(data, '$.category'), 'Praise & Worship')`,
matching `listSongs`.

### Months and Sundays

- `month` is `"YYYY-MM"`, years 2000-2100, months 01-12.
- `sundaysInMonth(month)` returns ISO dates (`"YYYY-MM-DD"`) in order. It uses
  UTC date math only, so the server time zone never shifts a day.
- Display dates are formatted with `Intl.DateTimeFormat` using `timeZone: "UTC"`,
  for example "Sunday, October 4".

### Tables (created with `IF NOT EXISTS` in `initialize()`)

```sql
CREATE TABLE IF NOT EXISTS lineups (
  id TEXT PRIMARY KEY,            -- randomUUID()
  owner_hash TEXT NOT NULL,       -- ownerHash(cookie token); never sent to clients
  month TEXT NOT NULL,            -- 'YYYY-MM'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_hash, month)
);
CREATE TABLE IF NOT EXISTS lineup_slots (
  lineup_id TEXT NOT NULL REFERENCES lineups(id) ON DELETE CASCADE,
  sunday TEXT NOT NULL,           -- 'YYYY-MM-DD', must be a Sunday of the lineup month
  slot TEXT NOT NULL,             -- singspiration | worship1 | worship2 | closing
  song_id TEXT NOT NULL,          -- songs.id; may dangle after another owner deletes the song
  PRIMARY KEY (lineup_id, sunday, slot)
);
CREATE INDEX IF NOT EXISTS lineup_slots_song ON lineup_slots(song_id);
```

Do not rely on `ON DELETE CASCADE`, because SQLite foreign keys may be off.
Deleting a lineup deletes its slot rows explicitly, in the same `batch`.

### API

All responses are JSON. Errors use the existing `{ error }` shape through
`apiError`. Mutations go through `readBody` (or `checkOrigin` for DELETE),
which provides the same-origin, JSON, and size checks. Lineup ids in the path
must match the UUID format, otherwise 404.

- `GET /api/lineups` returns `{ lineups: [{ id, month, updatedAt }] }` for the
  caller's cookie, sorted by month descending. With no cookie it returns
  `{ lineups: [] }`. Uses `Cache-Control: private, no-store`.
- `POST /api/lineups` takes `{ month }`.
  - Creates the lineup and returns 201, or returns the existing one for this
    owner and month with 200.
  - Body: `{ lineup: { id, month } }`.
  - Sets the owner cookie exactly as `POST /api/songs` does when absent.
  - An invalid month returns 400.
- `GET /api/lineups/[id]` returns `{ lineup, canEdit }` (`private, no-store`):

  ```ts
  type LineupSong = { id: string; slug: string; title: string; artist: string;
                      category: SongCategory; defaultKey: string };
  type SlotValue = LineupSong | { removed: true } | null;
  type Lineup = { id: string; month: string; updatedAt: string;
                  sundays: { date: string; slots: Record<SlotKey, SlotValue> }[] };
  ```

  - Every Sunday and all four slot keys are always present.
  - A slot row whose song no longer exists returns `{ removed: true }`.
  - Unknown id returns 404 "This lineup could not be found."
- `PATCH /api/lineups/[id]` takes `{ sunday, slot, songId: string | null }`.
  It returns the full `{ lineup, canEdit: true }` and responds:
  - 403 "Only the browser that created this lineup can change it." for a non-owner
  - 400 for a Sunday not in the month, an unknown slot, or a malformed songId
  - 404 "That song could not be found." for an unknown song
  - 400 "Choose a Singspiration song for this slot." or "Choose a Praise &
    Worship song for this slot." for the wrong category
  - Assignment is one upsert: `INSERT ... SELECT ... WHERE EXISTS (song with
    the allowed category) ON CONFLICT DO UPDATE`. `songId: null` deletes the
    row. Both bump `lineups.updated_at`, and both are scoped `WHERE` the lineup's
    `owner_hash` matches.
- `DELETE /api/lineups/[id]` returns `{ success: true }`. A non-owner gets 403.

### Song delete guard

`deleteSong` keeps its 404 and 403 checks, then runs one statement:

```sql
DELETE FROM songs WHERE slug = ? AND owner_hash = ?
  AND NOT EXISTS (SELECT 1 FROM lineup_slots s JOIN lineups l ON l.id = s.lineup_id
                  WHERE s.song_id = songs.id AND l.owner_hash = ?)
```

If `rowsAffected` is 0, it throws 409 "This song is in one of your monthly
lineups. Remove it from the lineup first." Other owners' slot rows are left in
place and read back as `removed`.

## Testing

- Unit (`npm test`, new `tests/lineups.test.ts`, added to the script):
  - `sundaysInMonth`: 2026-10 has 4 Sundays starting 10-04; 2026-11 has 5
    starting 11-01; 2028-02 has 4 (leap year); 2026-03 has 5 and starts on Sunday
    03-01; invalid input throws
  - Month validator: rejects `2026-13`, `2026-1`, `1999-12`, and non-strings
  - Slot assignment validator: unknown slot, a non-Sunday date, a Sunday from
    another month, a non-UUID or empty songId, and `null` accepted as clear
  - Slot category map: matches the table above
- Integration: step 5 in `tests/api.integration.mjs`. It runs only against a
  live dev server, manually or in `/check`.
- UI: verified in the dev server during `/check`. No browser test command is
  configured.
- No Verify command exists. The gate is `npm test` plus `npm run typecheck`, and
  `npm run build` before `/complete`.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for route handler and dynamic `params`
  conventions before writing routes. Match the existing `[slug]` route, where
  `params` is a Promise.
- Follow existing patterns:
  - Validators throw `ApiError` with short user-facing sentences.
  - Pages are thin wrappers around client components that call `lib/api.ts`.
  - Use semantic CSS classes in `globals.css` and `no-print` on controls.
  - Use lucide icons and `ConfirmDialog` for the lineup delete.
- Slot pickers reuse `GET /api/songs` with the `category` and `search` params.
  Closing omits `category`. Do not add a new song-search endpoint.
- Song titles and artists are user text. Render them through React only, with no
  `dangerouslySetInnerHTML`.
- Each picker is labeled with its Sunday and slot, for example "Sunday, October
  4 - Worship song 1". Save feedback and errors use `role="status"` next to that
  slot, and the message clears on the next change.
- The owner hash never leaves the server. Ownership is decided only from the
  HTTP-only cookie, never from the request body.
- Owner-only lineup delete was added to the planned scope because, without it,
  test data and mistaken months could never be removed. Drop it if the user
  rejects it at review.

## Open questions

None blocking. The user chose browser ownership with shareable links, and a
delete block that applies only to the caller's own lineups.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":12858,"specSha256":"1a4ab5577dc8e46b69a7526c0ea2a36560fd2b5c2f82ff45871f2054eedc2d36","branch":"refs/heads/feature/monthly-song-lineup","head":"6c7977c64b07727488f05dfa257e386a54a47ff9","baseRef":"refs/heads/main","baseCommit":"3565085d5dc41f63cdb14bf69a68dc141ee2d925","sourceTree":"d8b9989f670fcd518356302c1de49dac6002a954","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 6c7977c64b07727488f05dfa257e386a54a47ff9
**Base commit:** 3565085d5dc41f63cdb14bf69a68dc141ee2d925
**Base ref:** main
**Spec hash:** 1a4ab5577dc8e46b69a7526c0ea2a36560fd2b5c2f82ff45871f2054eedc2d36
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-02T10:11:17Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-02T10:13:20Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `3565085d5dc41f63cdb14bf69a68dc141ee2d925..6c7977c64b07727488f05dfa257e386a54a47ff9` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `npm test`: pass (17 tests, 0 failed, 0 skipped)
- `npm run typecheck`: pass
- `npm run build`: pass (`next-env.d.ts` restored with `git checkout -- next-env.d.ts` afterwards)
- Ad hoc in-memory `@libsql/client` run of the slot upsert and song delete guard SQL: pass
- `npm run test:api`: unavailable (needs a running dev server, which this reviewer was told not to start)

### Evidence

- Preconditions verified: `HEAD` equals Target commit, `git merge-base main HEAD` equals Base commit, SHA-256 of the raw spec bytes equals Spec hash, and only `blueprint/context/review.md` differed from the target before the review.
- All 21 non-spec files in the delta were read. `lib/server/db.ts`, both lineup routes, `lib/server/http.ts`, `lib/server/validation.ts`, `lib/lineups.ts`, and the three lineup components were read in full.
- Authorization: `assignSlot` and `deleteLineup` check the HTTP-only cookie hash through `lineupAccess` and `requireOwner` before validating input, and every write statement repeats the `owner_hash` predicate. Ownership is never read from the request body, and `owner_hash` is not selected into any response.
- Mutations: POST and PATCH go through `readBody`, DELETE through `checkOrigin`. Path ids must match `UUID_PATTERN`, otherwise 404. All SQL is parameterized; the only interpolated fragments are constants.
- SQL behaviour confirmed in memory: the upsert affects 1 row for an owner with an allowed category (including the `COALESCE` default) and 0 rows for a wrong category, a non-owner, or a missing song. The guarded delete affects 0 rows for a song in the caller's own lineup and 1 row when only another owner's lineup uses it, whose slot then reads back with null song data (`removed`).
- `createLineup` runs its insert-or-ignore and select in one write batch. `deleteLineup` removes slots and the lineup in one write batch without relying on `ON DELETE CASCADE`.
- The `?lineup=` back link accepts only a UUID and builds a same-site path. No `dangerouslySetInnerHTML`, `any`, or skipped or focused tests in the delta.

### Findings

- F-01 [P2] open - Search inputs lose their visible focus indicator (app/globals.css:413)
- F-02 [P3] open - Slot picker shows only the first 12 songs with no indication of more (components/lineups/SlotPicker.tsx:25)
- F-03 [P3] open - Slot write and `updated_at` bump are separate statements (lib/server/db.ts:359)
- F-04 [P3] open - Integration check proves 403 with no cookie, not a foreign cookie (tests/api.integration.mjs:131)
- F-05 [P3] open - Shared body-reader errors say "song" on lineup requests (lib/server/http.ts:47)
- F-06 [P3] unverified - Overlapping slot saves can leave the lineup view stale (components/lineups/LineupPage.tsx:38)
- No P0 or P1 findings.

### Remaining risk

- `npm run test:api` was not run, so the HTTP status codes, cookie setting, and cleanup behaviour of the lineup endpoints were verified by code reading and the in-memory SQL run, not against a live server.
- No browser evidence was gathered: no dev server was started and no Browser tests command is configured. Lineup screens, picker interaction, the read-only view, and print behaviour were reviewed by code reading only.
- SQL was exercised against local in-memory SQLite only, not against Turso.
- No lint, security scan, or performance command is configured in this project.
- The reviewer runtime refused the write to `blueprint/context/findings.md`, so F-01 through F-06 are not yet in the ledger. Their full entries were returned in the reviewer's handback and must be copied into the ledger verbatim. None is P0 or P1, so the verdict does not depend on it.
- Dashboard activity state (`blueprint/.state/run.json`) was not written, because this reviewer was limited to writing the findings ledger and this receipt.
