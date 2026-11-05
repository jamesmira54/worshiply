# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-08 [P3] open - Lockout expiry and the lineup de-duplication migration have no automated test

**File:** lib/server/db.ts:45
**Found:** 2026-11-05 by /audit independent (scope: current; lens: tests)
**Why it matters:** The two most delicate data paths in this feature are covered only by manual or live checks. The one-time lineup migration (lib/server/db.ts:45-47, `NEWER_LINEUP` at :57) deletes lineups and slots on first startup, and the lockout reservation SQL (lib/server/auth.ts:93-95) has three branches (count, lock at 5, restart after expiry). `npm run test:api` exercises only the sequential 5-failure path; nothing automated checks keeper selection (newest `updated_at`, tie broken by highest `id`), idempotence, or the post-expiry restart. This review confirmed all of them by running the exact SQL against an in-memory libsql database, so there is no known defect, but a later edit could regress them silently.
**Suggested fix:** Optional, proportional: add a small `node:test` file that runs the migration statements and the reservation statement against `createClient({ url: ":memory:" })` (already installed). That needs the SQL strings importable without `server-only`, for example by moving `NEWER_LINEUP` and the reservation SQL into a plain module. Alternatively accept the gap and rely on the live checks. No current requirement would be lost either way.
**Resolution:**

### F-09 [P3] open - Too-long reference video gives the generic length message, not the spec's YouTube message

**File:** lib/server/validation.ts:106
**Found:** 2026-11-05 by /audit independent (scope: current; lens: quality)
**Why it matters:** The spec's Data / contracts section says "A string that is too long or not a YouTube video gives 400 `{ error: "Paste a YouTube video link (youtube.com or youtu.be), or leave it empty." }`". `string("referenceVideo", 300)` throws first for a value over 300 characters, so the response is `referenceVideo must be text with at most 300 characters.` (confirmed by a `tsx` probe of `validateSong`). The status is still 400 and the editor's `maxLength={300}` keeps normal users from reaching it, so impact is limited to API callers and the raw field name `referenceVideo` in the message. The unit test only asserts `ApiError`, so it does not catch the wording.
**Suggested fix:** Either check the length separately and throw the YouTube message for an over-long string (keeping the existing type message for non-strings), or amend the spec's contract line to say over-long values get the existing length message. No current requirement would be lost either way.
**Resolution:**

### F-10 [P3] open - Reference video hint sits inside the label, so screen readers announce it twice

**File:** components/editor/SongMetadata.tsx:95
**Found:** 2026-11-05 by /audit independent (scope: current; lens: quality)
**Why it matters:** The hint `<span id="reference-video-hint">` is a child of the wrapping `<label className="video-field">`. When the value is invalid, the input's accessible name becomes "Reference video Use a YouTube video link, like https://youtu.be/…" and `aria-describedby` then announces the same hint again as the description. This is a minor accessibility polish issue, not a functional defect.
**Suggested fix:** Move the hint span out of the `<label>` (directly after it, inside the same grid cell), keeping `aria-invalid` and `aria-describedby` unchanged. No current requirement would be lost.
**Resolution:**
