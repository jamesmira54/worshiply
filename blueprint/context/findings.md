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
