# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P1] fixed - Sign-in `next` allows an off-site redirect through tab or newline characters

**File:** lib/server/passwords.ts:55
**Found:** 2026-11-03 by /audit independent (scope: current; lens: security)
**Why it matters:** `safeNext` checks only the raw string prefix. The WHATWG URL parser strips ASCII tab and newline before resolving, so `/sign-in?next=/%09/evil.example` decodes to `"/\t/evil.example"`, passes all three checks, and resolves to `http://evil.example/` (verified with `new URL("/\t/evil.example", "http://localhost:3000")`). The value reaches `router.replace(next)` in `components/SignInForm.tsx:23`, where Next's app router marks the resolved URL external and performs a hard navigation off-site (`app-router-instance.js` `isExternalURL` -> `completeHardNavigation`), and also `redirect(next)` in `app/sign-in/page.tsx:15` for an already-signed-in visitor. This breaks the spec contract "an off-site `next` value falls back to `/songs`" and gives a phishing redirect right after a real sign-in.
**Suggested fix:** Resolve the value against a fixed dummy origin (`new URL(value, "http://local.invalid")`), require the resulting origin to equal that dummy origin, and return `pathname + search + hash`; or reject any value containing control characters (`\x00-\x1f`) or a backslash anywhere. Add `"/\t/evil.example"` and `"/\n/evil.example"` to the `safeNext` unit test.
**Resolution:** Fixed 2026-11-03: `safeNext` resolves against a fixed origin and keeps only same-origin path+search+hash. Unit tests cover `//`, `/\`, tab, LF, CR/LF; live `/sign-in?next=/%09/evil.example` while signed in → 307 to `/songs`.

### F-02 [P2] fixed - Lockout is check-then-act, so concurrent attempts bypass the 5-attempt limit

**File:** lib/server/auth.ts:86
**Found:** 2026-11-03 by /audit independent (scope: current; lens: security)
**Why it matters:** `signIn` reads `locked_until`, then awaits scrypt, then increments `failed_attempts`. Every request that reads the row before the fifth failure is recorded gets a full password check, so a burst of N parallel requests at the start of each 15-minute window yields N guesses instead of 5. The atomic UPDATE keeps the counter consistent but does not stop in-flight guesses. The 10-character minimum and scrypt cost limit the practical impact, so this is a weakened control rather than an open door.
**Suggested fix:** Reserve the attempt before verifying: one conditional `UPDATE users SET failed_attempts = failed_attempts + 1 ... WHERE id = ? AND (locked_until IS NULL OR locked_until <= ?) RETURNING failed_attempts` (lock when it reaches 5), treat zero affected rows as 429, and reset on success. No new dependency needed.
**Resolution:** Fixed 2026-11-03: sign-in reserves the attempt with `UPDATE ... WHERE locked_until IS NULL OR locked_until <= ? RETURNING failed_attempts` before scrypt; attempts beyond 5 get 429 without a password check, and the 5th failure sets the lock. Live burst of 10 parallel wrong passwords → 5×401, 5×429; correct password afterwards → 429. `npm run test:api` lockout section passes.

### F-03 [P3] fixed - Admin lost the "Make a copy" action on the song page

**File:** components/SongPage.tsx:71
**Found:** 2026-11-03 by /audit independent (scope: current; lens: quality)
**Why it matters:** The spec says the song page hides Edit, Make a copy, and Delete *for non-admins*, and admins keep "copy". The diff deleted the `duplicate()` handler and button entirely, so the admin can now copy only from the library's Duplicate action. Small spec drift and a lost shortcut.
**Suggested fix:** Restore the Make a copy button behind `canEdit`, or record the removal as an intentional spec change.
**Resolution:** Fixed 2026-11-03: "Make a copy" restored on the song page beside "Edit song", shown only when `canEdit` (admin).

### F-04 [P3] fixed - Expired sessions are never purged unless their cookie is presented again

**File:** lib/server/auth.ts:35
**Found:** 2026-11-03 by /audit independent (scope: current; lens: performance)
**Why it matters:** Expired rows are deleted only when the same token is looked up. Sessions from cleared browsers or abandoned devices stay in the `sessions` table forever, so it grows without bound (slowly, for a church-team app).
**Suggested fix:** Add `DELETE FROM sessions WHERE expires_at <= ?` to the sign-in write batch (or to `initialize()`); no scheduler needed.
**Resolution:** Fixed 2026-11-03: the sign-in write batch also runs `DELETE FROM sessions WHERE expires_at <= ?`.

### F-05 [P3] fixed - Session lookup runs twice per page request and makes every page dynamic

**File:** lib/server/auth.ts:48
**Found:** 2026-11-03 by /audit independent (scope: current; lens: performance)
**Why it matters:** The root layout and the gated pages (`/songs`, `/lineups`, `/users`, `/sign-in`, editor pages) each call `pageAccount()`, so one navigation runs the session JOIN twice. Reading `cookies()` in the root layout also makes `/` and `/_not-found` dynamic (build output shows every route as dynamic).
**Suggested fix:** Wrap `pageAccount` in React's `cache()` so a request does one lookup. Accept the dynamic layout as the cost of the server-rendered header, or note it.
**Resolution:** Fixed 2026-11-03: `pageAccount` wrapped in React `cache()`, so layout and page share one lookup per request. The dynamic layout is the accepted cost of the server-rendered header.

### F-06 [P3] fixed - Shared body and error helpers still use song-specific messages for auth and user endpoints

**File:** lib/server/http.ts:61
**Found:** 2026-11-03 by /audit independent (scope: current; lens: quality)
**Why it matters:** `readBody` and `apiError` now serve sign-in, users, and lineups, but still say "Send the song as JSON.", "This song is too large.", "The song contains invalid JSON." (lines 61-82), and log "Song API operation failed" (line 91). A malformed sign-in or add-user request shows a confusing song message.
**Suggested fix:** Make the messages generic ("Send the request as JSON.", "This request is too large.") or pass a noun in from the caller.
**Resolution:** Fixed 2026-11-03: `readBody` and `apiError` messages are generic ("Send the request as JSON.", "This request is too large.", "API operation failed").
