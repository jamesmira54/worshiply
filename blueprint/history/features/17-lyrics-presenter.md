# Feature: Lyrics presenter

**From build-plan:** feature 17
**Build attempt:** 1
**Branch:** feature/lyrics-presenter
**Status:** verified

## Goal

Let the operator project worship lyrics for the congregation the way a slide
show is projected. On the laptop, a control window shows the current and next
slide plus the slide list. A separate audience window, dragged onto the
projector, shows only the lyrics: large, centered, white on black. Slides come
automatically from the song's sections with the chords removed. Nothing new is
stored.

## In scope

- **Ways to start it:**
  - A **Present** button on the song page, which presents that one song.
  - A **Present** button on each Sunday card of a monthly lineup, which presents
    that Sunday's assigned songs in slot order as one slide show.
- **Slides, built from the stored lyrics:**
  - Each song starts with a **title slide** showing its title, plus the artist
    when there is one.
  - Lyric slides follow, with chords stripped.
  - A section heading or a blank line starts a new slide group, and lines with
    only chords are dropped.
  - A group longer than 4 lines is split into balanced slides of at most 4 lines
    (5 → 3+2, 6 → 3+3, 9 → 3+3+3).
- **Control window:** an in-page modal `<dialog>`, using the same pattern as
  performance mode. It shows:
  - The current slide and a **next slide preview** side by side.
  - A clickable slide list grouped by song, where the current slide has
    `aria-current`.
  - Previous and Next buttons, a Blank toggle, Open audience window, and Exit.
- **Audience window:** opened with `window.open` from a click. It shows only the
  current slide, white Noto Sans text on black, sized to the window. A
  double-click toggles fullscreen on the projector.
- **Text size on the projector** (added after review):
  - **Auto-fit:** the audience text always fits the window. After every slide
    change, window resize, text-size change and font load, the lyrics shrink
    from the chosen size until nothing overflows, down to a 12px minimum. Long
    words may wrap.
  - **Manual nudge:** A− / A+ buttons in the control window, plus the − and +
    keys (`-`, `+` and `=`) in both windows, step the base size through 60%,
    70%, 80%, 90%, 100%, 115%, 130% and 150%. The default is 100%, and the
    control window shows the current value ("Text 100%"). The buttons are
    disabled at either end.
  - The size is not saved; every presenter session starts at 100%.
- **Blank screen:** the Blank button or the B key shows a plain black audience
  screen without closing it. The control window says "Screen blanked". Moving
  between slides while blanked keeps the screen blank until it is toggled off.
- **Keyboard:** these work in both windows.

  | Key | Action |
  | --- | --- |
  | → / PageDown / Space | Next slide |
  | ← / PageUp | Previous slide |
  | B | Toggle blank |
  | − / + | Smaller / larger text |
  | Escape | Exits the control dialog (Escape in the audience window only leaves fullscreen) |

  Next stops at the last slide and Previous at the first.
- **Lifecycle:**
  - Exit closes the audience window and returns focus to the Present button
    that opened the presenter.
  - If the operator closes the audience window, the control window shows "Open
    audience window" again.
  - The control window keeps the screen awake with the Wake Lock API, the same
    way performance mode does.
- **States:**
  - **Loading** (lineup Sunday): "Loading songs…" with the button disabled.
  - **Empty Sunday:** the Present button is disabled when no slot has a song.
  - **Song with no lyrics:** only its title slide.
  - **Lineup song that fails to load:** it is skipped, and the control window
    lists it as "Couldn't load: <title>". If every song fails, the presenter
    does not open and a `role="alert"` error appears on the card.
  - **Pop-up blocked:** a `role="alert"` message in the control window reads
    "Your browser blocked the audience window. Allow pop-ups for this site, then
    try again."

## Out of scope

- Editing, reordering or saving slides. Per-song slide settings.
- Bible verses (feature 18) and setlists (feature 13).
- Themes, backgrounds and fonts. Saving a text size between sessions.
- Chord display for the projector. Transposition doesn't apply, since chords are
  removed.
- Syncing across devices, or remote control from a phone.

## Build loop

`workflow.stepReview` is `feature`, so the build goes through all steps, then
gives one review packet. Checkpoint commits are disabled. `/complete` makes the
feature commit.

## Build steps

- [x] 1. **Slide builder.**
  - Add `lib/presenter.ts` with:
    - `songSlides(song)`, which takes the title, artist and lyrics.
    - `deckSlides(songs)`, which joins several songs into one deck.
    - `splitLines(lines, max = 4)`, which balances long groups.
  - Use `parseLyrics` from `lib/chord-parser.ts`. Add tests in
    `tests/presenter.test.ts` and add that file to the `test` script in
    `package.json`.
  - Done when `npm test` passes, with tests for:
    - chords stripped
    - chord-only lines dropped
    - section and blank-line grouping
    - the 4-line split rule (4, 5, 6 and 9 lines)
    - the title slide with and without an artist
    - empty lyrics giving only the title slide
    - deck order across songs
- [x] 2. **Control window and audience window.**
  - Add `components/presenter/PresenterView.tsx` with the props
    `{ songs: SongInput[]; skipped?: string[]; onClose(): void }`, containing:
    - the dialog
    - current and next panels
    - the slide list
    - the buttons and keyboard handling
    - the blank state
    - the wake lock
    - the audience window, rendered with `createPortal` into a container in
      that window's document
  - The audience document gets its `<title>` and a `<style>` element built with
    DOM APIs, plus `@font-face` rules pointing at `/fonts/NotoSans-*.ttf`.
  - Watch for the audience window closing with a `pagehide` listener and a
    1-second `closed` check, and close it in the effect's cleanup.
  - Add CSS in `app/globals.css` for the control window.
  - Done when `npm run typecheck` passes.
- [x] 3. **Entry points.**
  - **Song page:** add a Present button to `components/SongPage.tsx`, next to
    Perform, that presents `canonical`. Exit returns focus to the button.
  - **Lineup page:** add a Present button to each Sunday card in
    `components/lineups/LineupPage.tsx` with the class `no-print`.
    - It is disabled when `sundayQueue(lineup, date)` is empty.
    - It loads every song in parallel from `/api/songs/:slug`, keeping slot
      order and skipping failures, then opens `PresenterView`.
    - It shows the loading state, and an error on the card when every song
      fails.
  - Done when typecheck, tests and `npm run build` pass, and both buttons open
    the presenter.

- [x] 4. **Responsive text size** (added after review).
  - In `lib/presenter.ts`, add:
    - `TEXT_SCALES`, the list of size steps
    - `DEFAULT_SCALE_INDEX`
    - `fitFontSize(start, min, fits)`, a pure function that returns the largest
      size from `start` down to `min` for which `fits(size)` is true, found by
      binary search to a 0.5px precision. It returns `min` when nothing fits.
  - Reuse `stepIndex` from `lib/performance.ts`.
  - In `PresenterView.tsx`:
    - Keep a scale index and add the A− / A+ controls and the − / + keys.
    - Set `--presenter-scale` on the preview panels.
    - In the audience window, measure the slide with the base size
      `min(7vh, 4.2vw) × scale` (and the title-slide ratios), then apply
      `fitFontSize`. This runs in a layout effect after a slide, blank or scale
      change, on the audience window's `resize` event, and when the window's
      `document.fonts.ready` resolves.
  - Done when `npm test` passes with `fitFontSize` tests (fits at the start
    size, shrinks to the largest fitting size, floors at the minimum) and a
    test of the scale steps, and typecheck and build pass.

- [x] 5. **Control window layout repair** (found in review).
  - **Bug:** on a lineup with several songs, the black "Now showing" screen
    spills over the slide list, and the "Next" panel is pushed off the right
    edge.
  - **Root cause:** `.presenter-dialog[open]` uses
    `grid-template-rows: auto auto auto 1fr`, but the dialog has up to six
    children (controls, two optional messages, the hint, the preview panels and
    the list). The `1fr` row squeezes `.presenter-main` (`min-height: 0`), so the
    16:9 screens overflow it. The `3fr 2fr` columns also have no `minmax(0, …)`,
    so the screens' aspect ratio can widen them past the window.
  - **Fix** (CSS only, in `app/globals.css`):
    - Lay the dialog out as a single scrolling column (`display: flex; flex-direction: column`), so every section takes its natural height.
    - Change the preview columns to `minmax(0, 3fr) minmax(0, 2fr)` with
      `align-items: start`.
    - Give the screens `width: 100%` and cap the "Now showing" screen's height
      at about 55vh, so the slide list stays visible below it on a laptop.
  - **Must not break:** the one-column layout at ≤760px, the blanked style, and
    the audience window (which has its own styles).
  - Done when typecheck and build pass, and on a lineup with 4 songs the
    previews sit side by side within the window with the slide list fully below
    them, with or without the "Couldn't load" and pop-up messages showing.

## Files / areas

- New: `lib/presenter.ts`, `tests/presenter.test.ts`,
  `components/presenter/PresenterView.tsx`.
- Changed: `components/SongPage.tsx`, `components/lineups/LineupPage.tsx`,
  `app/globals.css`, `package.json` (the test script only).
- Reused:
  - `parseLyrics` (`lib/chord-parser.ts`)
  - `sundayQueue` (`lib/lineups.ts`)
  - `api` (`lib/api.ts`)
  - the dialog, fullscreen and wake-lock patterns from
    `components/performance/PerformanceView.tsx`

## Data / contracts

- No stored data, no API changes and no new routes. The audience window is an
  `about:blank` pop-up from the same origin, rendered by the control window's
  React tree.
- The slide shape is internal to the browser:
  `{ kind: "title" | "lyrics"; songIndex: number; songTitle: string; label?: string; lines: string[] }`.
  `label` is the section name, shown only in the control window.
- **Authorization doesn't change:**
  - Song reads stay public through `GET /api/songs/:slug`.
  - The lineup page already requires a signed-in account (`GET /api/lineups/:id`).
  - Presenting adds no new permissions.
- **Safe rendering:** lyrics, titles and artists are user text. Render them only
  as React text nodes. Set the audience document's title with `document.title`.
  Never use `innerHTML` or `document.write` with user content.

## Testing

- `npm test` covers the slide builder in step 1.
- `npm run typecheck` and `npm run build` run after steps 2 and 3.
- `npm run test:api` is not affected, since there are no API changes.
- A manual browser check is needed, because pop-ups, a second screen and
  fullscreen can't be tested automatically here:
  1. From a song page, Present opens the control window, and Open audience
     window opens the pop-up.
  2. The keys move between slides in both windows, and B blanks the screen.
  3. Double-clicking the audience window makes it fullscreen.
  4. Exit closes both windows.
  5. Resizing the audience window keeps the text inside it, A− / A+ and
     − / + change the size, and a very long line shrinks to fit.
  6. Present on a lineup Sunday shows every assigned song in slot order, each
     starting with its title slide.

## Notes for the AI

- Read `node_modules/next/dist/docs/` only if a Next.js API beyond client
  components is needed. None is expected.
- **React events and the audience window:** React's synthetic events don't
  reach a portal in another document. Attach native `keydown` and `dblclick`
  listeners to the audience window in an effect, and remove them in cleanup.
- **Opening the audience window:** call `window.open("", "worshiply-audience", "popup,width=1280,height=720")`
  directly in the click handler. If it returns `null`, show the pop-up-blocked
  message.
- **Fullscreen:** in the audience window, use its own
  `document.documentElement.requestFullscreen()` from the double-click.
- **Auto-fit measurement:** set `font-size` on the slide element in the
  audience document, then compare `scrollHeight`/`scrollWidth` with the
  `.audience` box's client size minus its padding. Use the title and artist
  ratios from the stylesheet (lyrics 1, title 9/7, artist 5/7) as `em` sizes
  inside the slide, so a single `font-size` scales all of them.
- **Text size:** use viewport units in the audience styles, for example
  `font-size: min(7vh, 4.2vw)` for lyrics. They resolve against the audience
  window. Keep line breaks as they are and center the text.
- **Wake lock:** duplicating performance mode's small wake-lock block is fine.
  Don't refactor `PerformanceView`.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":13056,"specSha256":"ca44b869d0a2474357918a8441fd509c4f9c1c3677466750e28f70b2182de60b","branch":"refs/heads/feature/lyrics-presenter","head":"0eb44b336538810a91b293bdb4cabcb326254705","baseRef":"refs/heads/main","baseCommit":"0eb44b336538810a91b293bdb4cabcb326254705","sourceTree":"198e1cddc9370702c597fc6e77f072d3a85bb38b","absentOptional":[]} -->
