# Feature: Performance mode

**From build-plan:** feature 14
**Build attempt:** 1
**Branch:** feature/performance-mode
**Status:** verified

## Goal

Give musicians a distraction-free view for playing live. From any song page, a
**Perform** button opens the song in a view that fills the screen, uses large
text, can scroll by itself at a speed the player picks, and keeps the screen
from turning off while it is open.

## In scope

- A **Perform** button in the song page actions, for everyone who can view the
  song. Songs are publicly readable, so this needs no sign-in and no server
  change. It also works when the song was opened from a monthly lineup
  (`/songs/<slug>?lineup=<id>`).
- Performance mode shows the song **as currently shown on the page**: the
  temporary key, chords on or off, and the chord diagram setting all carry over.
  Nothing is saved, and the stored song does not change.
- **Large text:** its own text-size control (smaller/larger buttons over fixed
  steps), starting larger than the normal sheet.
- **Full screen:** enters browser full screen on open where the browser allows
  it. A Full screen toggle appears only where the Fullscreen API exists. Where it
  doesn't (for example, iPhone Safari), the view still fills the browser window.
- **Auto-scroll:** Play/Pause, plus Slower and Faster buttons over fixed speed
  steps. Speed is set by hand and is not derived from BPM. When the bottom is
  reached, auto-scroll pauses. Pressing Play at the bottom starts again from the
  top. If the player scrolls by hand while it plays, it carries on from the new
  position.
- **Screen stays awake:** while the view is open, it requests the browser's
  screen wake lock, asks again when the tab becomes visible again, and releases
  it on exit. Where the browser doesn't support it or refuses, nothing is shown
  and nothing breaks.
- **Exit:** an Exit button and the Escape key close the view. If full screen is
  active, Escape first leaves full screen (browser behavior) and a second press
  closes the view. Exiting stops auto-scroll, leaves full screen, releases the
  wake lock, and returns focus to the Perform button.
- **Keyboard:** Space toggles auto-scroll when focus isn't on a button or select.
- **Lineup navigation** (added at the user's request during implementation):
  - **Links:** a song opened from a monthly lineup slot carries the Sunday and the
    slot in its link: `/songs/<slug>?lineup=<id>&sunday=<YYYY-MM-DD>&slot=<slot key>`.
  - **Order:** in performance mode, that Sunday's assigned songs are played in
    slot order (Singspiration, Worship 1, Worship 2, Closing). Empty slots and
    removed songs are skipped.
  - **Buttons:** Previous and Next, labelled with the neighbouring song's title,
    disabled at the ends, plus "Song N of M · <slot label>".
  - **Moving between songs:** the next song loads inside the open view. Full
    screen, the wake lock and the text size stay as they are. Scrolling resets to
    the top and auto-scroll pauses. The loaded song shows its own saved key and
    settings, since only the first song carries the page's temporary changes.
    While it loads, the buttons are disabled and the status is
    announced as "Loading song…". If it fails, an inline alert shows and the current song stays.
  - **Exit:** after moving to another song, Exit lands on that song's page with
    the same lineup, Sunday and slot parameters.
  - **Who sees it:** lineup reads need sign-in, so a signed-out visitor, an old
    `?lineup=` link without the Sunday, or a Sunday or slot that doesn't match
    gets no navigation, quietly. Performance mode still works for the one song.

## Out of scope

- Navigation through a setlist (feature 13, Setlists), and moving across Sundays.
- Deriving scroll speed from BPM, and counting the song in.
- Remembering text size or speed between visits, or saving them on the song.
- Foot-pedal or page-turner mappings beyond Space and Escape, and swipe gestures.
- A separate URL or route for performance mode, and any server, API or data
  change. Lineup navigation reads the existing `GET /api/lineups/[id]` and
  `GET /api/songs/[slug]`.
- A dark or stage colour theme, and changes to print or export output.

## Build loop

Config: `workflow.stepReview: "feature"`, `workflow.checkpointCommits: "disabled"`.
Build all steps in order. Each step must pass its own Done when before the next
step starts. Then present one review packet for the whole feature. No checkpoint
commits; `/complete` makes the single feature commit.

## Build steps

- [x] **1. Performance logic and tests.** Add `lib/performance.ts`, a plain
  module with no React or DOM imports, containing:
  - `TEXT_SIZES` (pt): `[18, 22, 26, 32, 40, 48]`.
  - `SCROLL_SPEEDS` (px per second): `[10, 15, 20, 30, 40, 60, 80]`.
  - `DEFAULT_SPEED_INDEX = 2`.
  - `initialTextSizeIndex(songFontSize)`: index of 26pt, or the smallest step at
    or above the song's own size when that is larger (capped at the last step).
  - `stepIndex(length, index, delta)`: moves and clamps to `[0, length - 1]`.
  - `nextScrollPosition(position, pxPerSecond, elapsedMs, maxPosition)`: returns
    `{ position, atEnd }`. It keeps fractional positions, treats a negative or
    over-large `elapsedMs` (a tab coming back from the background) as capped at
    100 ms, and never goes past `maxPosition`.

  Add `tests/performance.test.ts` and add it to the `test` script in
  `package.json`.
  **Done when:** `npm test` passes, with cases for the clamps at both ends, the
  initial size for songs at 10, 26, 30 and 48pt, a fractional advance,
  stopping exactly at the end, and the elapsed-time cap. `npm run typecheck` passes.

- [x] **2. Performance view with large text.** Add
  `components/performance/PerformanceView.tsx` (client):
  - It is a native `<dialog>` opened with `showModal()`, following the
    `ConfirmDialog` pattern. Its `cancel` event (Escape) closes it. It is labelled
    "Performance mode" and named after the song title.
  - It contains a `.performance-stage` that is the scroll container. The stage
    holds a compact control bar (Exit, text Smaller/Larger with the current size
    shown) and `ChordSheet`, which renders the passed-in song with `fontSize`
    replaced by the chosen step.
  - `SongPage` gets a **Perform** button (lucide `MonitorPlay` or a similar icon)
    in `page-actions`. It opens the view with the current temporary `song` state
    and closes it via `onClose`.
  - CSS in `app/globals.css` uses semantic classes:
    - the dialog fills the viewport (`100dvh`/`100vw`, no max width);
    - inside the view, the sheet is full width, with no shadow and no fixed
      paper width, and the eyebrow and footer are hidden;
    - the whole view is `no-print`;
    - the control buttons are large enough to tap.
  - Long lines must wrap rather than scroll sideways at 48pt on a phone-width
    screen. Confirm `.chord-line` and `.chord-segment` wrapping at that size and
    adjust them only inside the view.

  **Done when:** in a browser, these all work, and typecheck and build pass:
  - From a song page, transposing to another key and then pressing Perform shows
    the sheet in that key at large text.
  - Smaller and Larger change the size and stop at the end steps.
  - Exit and Escape close the view, focus is back on Perform, and the stored song
    is unchanged after a reload.
  - At 375px width, there's no sideways scrolling at 48pt.

- [x] **3. Full screen and screen wake lock.** In `PerformanceView`:
  - **Full screen:**
    - On open, request full screen on `.performance-stage`. It's a descendant of
      the modal dialog, so its controls stay usable.
    - A Full screen toggle (`aria-pressed`) shows only when
      `document.fullscreenEnabled` and `requestFullscreen` exist.
    - Follow `fullscreenchange` so the toggle reflects Escape or browser exits.
    - A rejected request is ignored, and the view still fills the window.
  - **Wake lock:**
    - On open, request `navigator.wakeLock.request("screen")` when it exists.
    - Request it again on `visibilitychange` to visible while the view is open.
    - Release it, and leave full screen if active, on close and on unmount.
    - Errors are caught and not shown.

  **Done when:** in a browser, these all work, and typecheck and build pass:
  - In Chrome desktop, Perform enters full screen and the controls work there.
  - The toggle leaves and re-enters full screen and its pressed state follows.
  - Escape leaves full screen first and then closes the view.
  - With the Fullscreen API removed in devtools (or in a browser without it), the
    toggle is hidden and the view still opens.
  - The console shows no errors on open or close, including where wake lock is
    unavailable.

- [x] **4. Auto-scroll.** In `PerformanceView`:
  - **Controls:** Play/Pause (its label switches between "Start auto-scroll" and
    "Pause auto-scroll"), plus Slower and Faster. The speed is shown as "Speed N
    of 7" in a polite live region.
  - **Scrolling:** a `requestAnimationFrame` loop moves the stage's `scrollTop`
    using `nextScrollPosition`.
    - If `scrollTop` differs from the last value the loop set by more than 2px,
      the loop resyncs to it, so a manual scroll carries on from there.
    - At the end it pauses. Play at the end jumps to the top and starts.
  - **Space:** handled on the stage, ignored when the event target is a button or
    select, and it calls `preventDefault` so the page does not jump.
  - **Stop and clean up:** exit, unmount, and the tab being hidden stop the loop.

  **Done when:** in a browser, these all work, and `npm test`, typecheck and build
  pass:
  - Play scrolls steadily, and Faster and Slower visibly change the speed and stop
    at speeds 1 and 7.
  - Pause stops the scrolling.
  - A manual scroll during play carries on from the new spot.
  - Reaching the bottom pauses, and Play there restarts from the top.
  - Space toggles playback when focus is on the sheet, but not on a focused button.
  - Exit stops the scrolling.

- [x] **5. Lineup navigation.**
  - **Lineup logic and tests:** add `sundayQueue(lineup, sunday)` to
    `lib/lineups.ts`. It returns that Sunday's assigned songs in `SLOTS` order as
    `{ slot, label, slug, title }[]`, skipping `null` and `{ removed: true }`
    slots, and returns `[]` for a date not in the lineup. Test it in
    `tests/lineups.test.ts`.
  - **Link:** `LineupPage` slot links add `&sunday=<date>&slot=<key>`.
  - **Song route:** `app/songs/[slug]/page.tsx` passes `sunday` and `slot` to
    `SongPage` only when they match `^\d{4}-\d{2}-\d{2}$` and `SLOT_KEYS`.
  - **SongPage:** passes a `lineup` context `{ id, sunday, slot }` to
    `PerformanceView` only when all three are present.
  - **PerformanceView:**
    - When the view opens with a lineup context, it fetches
      `/api/lineups/<id>` and builds the queue. Any failure (401, 404, network)
      quietly leaves navigation off.
    - The current entry is the queue item whose `slot` matches. If no item
      matches, there is no navigation.
    - Previous/Next fetch `/api/songs/<slug>` and replace the displayed song. They
      reset the scroll to the top and pause auto-scroll. Fetches are aborted on
      unmount or on a newer request.
    - Exit calls `onClose(lastSlot)` with the slot and slug of the song showing.
      If it differs from the page's song, `SongPage` `router.replace`s to that
      song's URL with the same lineup, Sunday and slot parameters.

  **Done when:**
  - `npm test` passes, with `sundayQueue` cases for:
    - full, partly empty and removed slots;
    - the same song in two slots;
    - an unknown date.
  - Typecheck and build pass.
  - In a browser, signed in:
    - Opening a song from a lineup Sunday and pressing Perform shows "Song N of M"
      with Previous/Next titled with the neighbours.
    - Next and Previous change the song inside full screen, the scroll is back at
      the top, and the buttons stop at the ends.
    - Exit lands on the song being played.
  - Signed out, or from a plain song link, Perform shows no navigation.

- [x] **6. Header hamburger menu (user-requested fix during this feature).**
  The header nav overflowed from about 808px down. At 860px and narrower:
  - The header shows the brand and a menu button (`aria-expanded`,
    `aria-controls="main-menu"`, labelled "Open menu" / "Close menu").
  - The nav links and the account controls (username plus Sign in or Sign out,
    with text) move into a panel below the header. Links are stacked and the
    active one is highlighted.
  - The panel closes on navigation, on Escape (focus returns to the button), and
    on a tap outside the header.
  - Above 860px the header is unchanged: the menu wrapper uses `display: contents`.

  Files: `components/AppHeader.tsx`, `app/globals.css`.
  **Done when:** typecheck and build pass. In a browser:
  - At 808px, 576px, 375px and 320px the header shows the brand and the menu
    button without overlap.
  - The menu opens and closes, shows the right links for signed-out, user and
    admin, and Sign out works from it.
  - At 1024px and wider the header looks as before.

## Files / areas

- `lib/performance.ts` (new): text and speed steps, scroll math.
- `tests/performance.test.ts` (new), `package.json` (`test` script list).
- `components/performance/PerformanceView.tsx` (new): dialog, controls, full
  screen, wake lock, auto-scroll.
- `components/SongPage.tsx`: Perform button and open/close state.
- `components/chord-sheet/ChordSheet.tsx`: reused as is. Change it only if hiding
  the eyebrow and footer cannot be done with CSS scoped to the view.
- `app/globals.css`: performance view classes.
- `lib/lineups.ts` (`sundayQueue`), `tests/lineups.test.ts`.
- `components/lineups/LineupPage.tsx`: slot links carry the Sunday and slot.
- `app/songs/[slug]/page.tsx`: validates and passes `sunday` and `slot`.

## Data / contracts

- No API, database, cookie or stored-field changes. Performance mode reads the
  in-memory `Song` already loaded by `SongPage` and never writes it.
- `PerformanceView` props:
  `{ song: SongInput; lineup?: { id: string; sunday: string; slot: SlotKey }; onClose: (showing?: { slug: string; slot: SlotKey }) => void }`.
  It overrides only `fontSize`, and only in its own render. The `song` passed in
  is never mutated. Songs loaded through navigation are read-only copies from
  `GET /api/songs/[slug]`.
- Song URL query: `lineup` (UUID, existing), `sunday` (`YYYY-MM-DD`) and `slot`
  (one of `SLOT_KEYS`). Invalid values are dropped on the server page, not
  rejected. Lineup authorization is unchanged: `GET /api/lineups/[id]` already
  requires an account.
- Text sizes are `TEXT_SIZES` from `lib/performance.ts`, in pt, applied through
  the existing `--sheet-font` custom property. Speeds are `SCROLL_SPEEDS`, in CSS
  px per second. Both reset to their defaults each time the view opens.
- Song text is rendered only through `ChordSheet`'s existing React text nodes, so
  no new HTML injection path is added.

## Testing

- **Unit (`npm test`):** `tests/performance.test.ts` for everything in
  `lib/performance.ts` (step 1 cases), and `tests/lineups.test.ts` for
  `sundayQueue` (step 5 cases). These are the only new logic with assertable
  inputs and outputs.
- **Not unit-tested:** the dialog, full screen, wake lock and the animation loop
  are browser and UI behavior. Following the coding standards, they're verified
  in a browser plus `npm run typecheck` and `npm run build`. There's no browser
  harness, so the browser checks in steps 2-5 are manual and will be reported as
  such, not claimed as automated.
- **Final gate:** `npm run typecheck`, `npm test`, `npm run build`.
  `npm run test:api` is unaffected because there's no API change, but can be run
  as a regression check.

## Notes for the AI

- Read the relevant guides in `node_modules/next/dist/docs/` before writing code.
  Nothing here should need new Next.js APIs; it's a client component.
- `<dialog>` cannot be the fullscreen element itself, which is why full screen
  goes on `.performance-stage` inside it. Check that the top-layer stacking keeps
  the controls clickable in Chrome before moving on from step 3.
- `requestFullscreen` and the wake lock both need a user gesture or a visible
  page. Call them from the Perform click path (open effect right after the click)
  and treat any rejection as normal.
- Keep `ChordSheet` shared with print and export. Don't fork it. Scope every
  performance style under the view's class so the song page, print and exports
  stay byte-for-byte the same.
- Respect `no-print`. Icons come from `lucide-react`. No new dependencies.
- The defaults (26pt starting text, speed 3 of 7 at 20 px/s) are reversible UI
  choices, recorded here so review can adjust them.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":16851,"specSha256":"645b50a90cde9a513ea23a78d765d65cb9cba7b1f757e7924cd3aaaf5bc23d8c","branch":"refs/heads/feature/performance-mode","head":"eff9dcc86242a677c82b81a05cea0a4869120e45","baseRef":"refs/heads/main","baseCommit":"eff9dcc86242a677c82b81a05cea0a4869120e45","sourceTree":"d2606258495641cd47d05a7d39efad36c38c908a","absentOptional":[]} -->
