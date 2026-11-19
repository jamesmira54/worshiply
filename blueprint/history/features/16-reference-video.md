# Feature: Reference video

**From build-plan:** feature 16
**Build attempt:** 1
**Branch:** feature/reference-video
**Status:** verified

## Goal

Let the admin attach one optional YouTube link to each song, so a team member
who doesn't know a song can watch the original from the song page and get
familiar with it before rehearsal.

## In scope

- **One optional reference video per song**, stored with the song. Only the admin
  can set, change or clear it, because it's part of song editing, which is
  already admin-only.
- **Accepted links:** YouTube video links only.
  - `youtube.com/watch?v=…`, `youtu.be/…`, `youtube.com/shorts/…`,
    `youtube.com/live/…` and `youtube.com/embed/…`.
  - Hosts `youtube.com`, `www.`, `m.` and `music.`, plus `youtube-nocookie.com`.
  - Both `https` and `http`.
  - The link is stored in one canonical form,
    `https://www.youtube.com/watch?v=<id>`. Other parameters, such as a start
    time or a playlist, are dropped.
  - An empty value means "no video". Anything else is rejected with a clear
    message.
- **Editor:** a "Reference video" field in the editor's Song details panel.
  - It shows an inline hint while the value isn't a valid YouTube link, and the
    server's message if saving is rejected.
  - Clearing the field removes the video.
- **Song page:** when a song has a video, a "Reference video" section appears
  between the view toolbar and the chord sheet.
  - **Play here** loads the YouTube player in the page and starts it, using
    privacy-enhanced `youtube-nocookie.com`. Nothing loads from YouTube until
    someone presses it.
  - **Hide video** removes the player again.
  - **Open on YouTube** opens the video in a new tab.
  - The section is visible to everyone who can view the song, signed in or not,
    because songs are public.
- **Older songs** without the field behave as "no video".
- **Copying:** "Make a copy" and library Duplicate copy the video with the rest
  of the song.

## Out of scope

- PDF and Word exports and the printed sheet. The section is `no-print`, and the
  exporters are unchanged.
- Performance mode, which stays as it is.
- Several videos per song, labels, and non-YouTube sites.
- Keeping a start time or playlist from the pasted link.
- Showing videos in the library, lineups, or search, and checking that the
  video exists or is public.

## Build loop

Config: `workflow.stepReview: "feature"`, `workflow.checkpointCommits: "disabled"`.
Build all steps in order. Each step must pass its own Done when before the next
step starts. Then present one review packet for the whole feature. No checkpoint
commits; `/complete` makes the single feature commit.

## Build steps

- [x] **1. Link parsing, storage and validation.**
  - **New `lib/youtube.ts`:** a plain module with no React and no server-only
    code, used by both client and server. It contains:
    - `youTubeId(value)`: the 11-character ID (`[A-Za-z0-9_-]{11}`) from an
      accepted link, or `null`. Parse with `new URL`, match the host exactly
      against the allowed list, and accept only the path forms listed under
      In scope.
    - `canonicalVideoUrl(id)` and `embedVideoUrl(id)`. The embed URL is
      `https://www.youtube-nocookie.com/embed/<id>?autoplay=1&rel=0`.
  - **Song type:** add `referenceVideo: string` to `Song` in `types/song.ts`.
    `SongInput` picks it up automatically.
  - **`validateSong`:** optional, at most 300 characters, trimmed. An empty
    string is allowed. Any other value must pass `youTubeId`, otherwise
    `ApiError(400, "Paste a YouTube video link (youtube.com or youtu.be), or leave it empty.")`.
    Store `canonicalVideoUrl(id)`.
  - **Defaults:** `referenceVideo: ""` in `blankSong` (and so in
    `exampleSong`), and in the two song read paths in `lib/server/db.ts`
    (`listSongs` and `findSong`, next to the existing `category` default).
  - **Tests:** new `tests/youtube.test.ts`, added to the `test` script, plus
    cases in `lib/server/validation.test.ts`.

  **Done when:** `npm test` passes with cases for:
  - every accepted form and host, with extra parameters dropped;
  - wrong hosts, such as `youtube.com.evil.example`, `evil.example/youtube.com`
    and `notyoutube.com`;
  - `javascript:`, `data:` and plain text;
  - a bad ID length;
  - a channel or playlist link with no video;
  - validation storing the canonical form, empty staying empty, a missing field
    becoming `""`, and too-long or invalid values giving 400.

  Typecheck passes.

- [x] **2. Editor field.**
  - **Field:** in `components/editor/SongMetadata.tsx`, add a "Reference video"
    labelled `type="url"` input to the Song details panel, with
    `maxLength={300}` and placeholder `https://youtu.be/…`.
  - **Inline hint:** while the trimmed value is not empty and `youTubeId`
    returns `null`, the field gets `aria-invalid` and `aria-describedby` points
    to a hint, "Use a YouTube video link, like https://youtu.be/…". The hint
    clears as soon as the value is valid or empty. Saving still goes through
    the server, and its 400 message shows in the editor's existing save error.

  **Done when:** typecheck and build pass. In a browser, as the admin:
  - Pasting a `youtu.be` link and saving stores it; after a reload the editor
    shows `https://www.youtube.com/watch?v=<id>`.
  - Typing `hello` shows the hint, and forcing a save shows the server message.
  - Clearing the field and saving removes the video.

- [x] **3. Song page section.**
  - **Component:** new `components/ReferenceVideo.tsx` (client), with props
    `{ url: string; title: string }`.
    - It renders nothing when `youTubeId(url)` is `null`.
    - Otherwise it renders a `no-print` `<section aria-labelledby>` with the
      heading "Reference video", a **Play here** / **Hide video** toggle
      (`aria-expanded`, `aria-controls`) and an **Open on YouTube** link.
    - The link uses `canonicalVideoUrl(id)`, `target="_blank"` and
      `rel="noopener noreferrer"`.
    - When playing, it renders an `<iframe>` with `embedVideoUrl(id)`, the title
      `Reference video: <song title>`,
      `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`,
      `allowFullScreen` and `referrerPolicy="strict-origin-when-cross-origin"`,
      in a 16:9 responsive frame.
  - **Placement:** `SongPage` renders it between `.view-toolbar` and
    `.song-view-canvas`, using the canonical (saved) song.
  - **CSS** in `app/globals.css` uses semantic classes.

  **Done when:** typecheck and build pass. In a browser:
  - A song with a video shows the section, signed out too. A song without one
    shows nothing.
  - The page makes no request to YouTube or youtube-nocookie until Play here is
    pressed (devtools Network).
  - Play here plays the video in the page, and Hide video removes it.
  - Open on YouTube opens the video in a new tab.
  - It works at 375px with no sideways scrolling.
  - Print preview and PDF/Word export don't show the video. Performance mode is
    unchanged.

## Files / areas

- `lib/youtube.ts` (new), `tests/youtube.test.ts` (new), `package.json` (`test` list).
- `types/song.ts`, `lib/song-defaults.ts`, `lib/server/validation.ts`,
  `lib/server/validation.test.ts`, `lib/server/db.ts` (read defaults only).
- `components/editor/SongMetadata.tsx`.
- `components/ReferenceVideo.tsx` (new), `components/SongPage.tsx`, `app/globals.css`.
- Typecheck may flag other `SongInput` literals, such as test fixtures, that
  need the new field. Add `referenceVideo: ""` there.

## Data / contracts

- **`Song.referenceVideo: string`**, inside the existing JSON `data` column. No
  new column, table or migration.
  - The value is either `""` or exactly
    `https://www.youtube.com/watch?v=<11-char id>`.
  - Rows saved before this feature have no field and read as `""`.
- **API:** `POST /api/songs` and `PATCH /api/songs/[slug]` accept
  `referenceVideo`. These routes are admin-only, unchanged.
  - Missing or empty means none. A string that is too long or not a YouTube
    video gives 400 `{ error: "Paste a YouTube video link (youtube.com or youtu.be), or leave it empty." }`.
  - A non-string gives the existing type message.
  - `GET` returns the canonical value.
- **Trust boundary:** the raw pasted text is never rendered as a link or frame
  source. The page builds both URLs from the validated 11-character ID only, so
  a stored value can't point anywhere except YouTube.
- **Exports:** `lib/export/*` builds its output from explicit fields and is not
  changed, so the new field can't leak into PDF or Word.

## Testing

- **Unit (`npm test`):** `tests/youtube.test.ts` for `youTubeId`,
  `canonicalVideoUrl` and `embedVideoUrl`, plus the new `validateSong` cases in
  `lib/server/validation.test.ts`. These cover the only new logic with
  assertable inputs and outputs, including the host-matching security cases.
- **Manual browser checks** (there's no browser harness): steps 2 and 3, reported
  as manual.
- **Final gate:** `npm run typecheck`, `npm test`, `npm run build`. Also run
  `npm run test:api` against the dev server as a regression check of the song API.

## Notes for the AI

- Read the relevant `node_modules/next/dist/docs/` guide before writing code.
  Nothing here should need new Next.js APIs.
- Match hosts exactly with `url.hostname`. Never use `includes` or `endsWith`
  on the raw string. Reject URLs with credentials or ports.
- The iframe loads only after a click. Don't pre-render a hidden iframe, and
  don't fetch thumbnails, so the page makes no YouTube request before the user
  asks.
- Keep `ChordSheet`, `PerformanceView` and the exporters untouched.
- The plan-file edits for feature 16 (build plan, project plan, overview) are
  uncommitted on `main` and travel with this branch into the feature commit.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":9796,"specSha256":"20588a754864ffb94366a2febae2e43a86a63e61c5a43cb61adbabbb21444f08","branch":"refs/heads/feature/reference-video","head":"6cb4cea19e3b26c41ca8689cd1ca7bb99cfc8d4a","baseRef":"refs/heads/main","baseCommit":"8b88404e12663ca73791b366de77d74d74eb46c8","sourceTree":"527027e8e46915b93b0d6dd333e2424da1e9b31d","absentOptional":[]} -->

## Independent review

**Status:** passed
**Target commit:** 6cb4cea19e3b26c41ca8689cd1ca7bb99cfc8d4a
**Base commit:** 8b88404e12663ca73791b366de77d74d74eb46c8
**Base ref:** main
**Spec hash:** 20588a754864ffb94366a2febae2e43a86a63e61c5a43cb61adbabbb21444f08
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-11-05T09:35:38Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-11-05T09:37:48Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `8b88404e12663ca73791b366de77d74d74eb46c8..6cb4cea19e3b26c41ca8689cd1ca7bb99cfc8d4a` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `npm run typecheck`: pass
- `npm test`: pass (35 tests, 0 fail, 0 skipped)
- `npm run build`: pass (`next-env.d.ts` restored to HEAD afterwards)
- `npx tsx <scratchpad probe>` of `youTubeId` and `validateSong`: pass (behaviour as expected; confirmed F-09 wording)
- `npm run test:api`: unavailable (needs a running dev server and admin credentials; not run)

### Evidence

- Freshness: `HEAD` = target, `git merge-base main HEAD` = base, raw SHA-256 of `current-feature.md` matches, only `blueprint/context/review.md` differed before review.
- Full delta reviewed (16 files): `lib/youtube.ts`, `lib/server/validation.ts`, `lib/server/db.ts`, `lib/song-defaults.ts`, `types/song.ts`, `components/ReferenceVideo.tsx`, `components/SongPage.tsx`, `components/editor/SongMetadata.tsx`, `app/globals.css`, `package.json`, `tests/youtube.test.ts`, `lib/server/validation.test.ts`, and the plan/overview/spec docs.
- Trust boundary: the `href` and iframe `src` are built only from `canonicalVideoUrl(id)` / `embedVideoUrl(id)` where `id` matches `^[A-Za-z0-9_-]{11}$`; stored text is never rendered. Host matching uses an exact `Set` lookup on `URL.hostname`; credentials and non-default ports are rejected; only http/https accepted. Probes: `youtube.com.` (trailing dot), percent-encoded IDs and look-alike hosts return null.
- No request to YouTube before the click: the iframe is rendered only while `playing` is true; no thumbnails or preloads. No CSP in `next.config.ts` blocks the embed.
- Writes stay admin-only (`requireAdmin` on POST/PATCH, unchanged). PATCH is full-replace via `validateSong`, and both editor save and both duplicate paths send the full song, so the video is kept or copied as specified. Old rows and old localStorage drafts get `referenceVideo: ""` via the db read defaults and `{ ...blankSong, ...draft }`.
- Exports, `ChordSheet` and `PerformanceView` untouched; section is `no-print`.
- Performance: one regex/URL parse per render, no new queries or network work.
- Tests: no `.only`/`.skip`; host-matching security cases and canonicalization covered.

### Findings

- F-09 [P3] open - too-long value returns the generic length message instead of the spec's YouTube message
- F-10 [P3] open - editor hint is inside the label, duplicating the accessible name and description
- F-08 [P3] open (earlier feature) unchanged; not affected by this delta

### Remaining risk

- `npm run test:api` was unavailable (needs a running dev server and admin credentials), so the song API regression check against a live server was not run in this review.
- Browser-only behaviour (no YouTube request before Play, 375px layout, print preview, new-tab link) was assessed by code reading only; no browser harness exists and Check was not required.
