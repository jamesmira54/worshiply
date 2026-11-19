# Fix: Past and upcoming Sundays on the lineup

**Type:** Fix
**Status:** verified
**Branch:** fix/past-and-upcoming-sundays-on-the-lineup

## The problem

The monthly lineup page (`components/lineups/LineupPage.tsx`) lists every Sunday
of the month as identical cards. A team member opening the month can't tell
which Sundays have already happened. They have to read the dates to find the one
coming up next, which is often the 3rd or 4th Sunday.

## The fix

- Add a pure helper `sundayTiming(date, today)` in `lib/lineups.ts`. Both
  arguments are `YYYY-MM-DD` strings, so a plain string comparison is correct.
  It returns `"past"` when `date < today`, otherwise `"upcoming"` or `"future"`.
- **Next upcoming Sunday:** the one Sunday where `date >= today` and
  `date < today + 7 days`. A Sunday that is today counts as upcoming, because
  it's today's service. So only one card in the whole calendar gets this mark,
  and a month that is entirely in the future marks only its first Sunday, and
  only when that Sunday is within the next 7 days.
- **Today's date** is the viewer's local date, computed on the client after
  mount (`useEffect`) and formatted as `YYYY-MM-DD` from local
  year/month/day. The server render shows no markers, so there is no hydration
  mismatch. The markers appear right after load.
- **Past cards** get the class `sunday-card past`, with muted text and
  background, plus a small "Past" label next to the heading.
- **The upcoming card** gets the class `sunday-card upcoming`, with an accent
  border, plus an "Upcoming" label.
- The labels are real text inside the `<h2>`'s container, not color alone, so
  screen readers announce them. Slot editing stays fully enabled on past
  Sundays.
- **Must not break:**
  - Print output: `@media print` keeps the cards plain, and the labels get
    `no-print`.
  - Lineup editing, the slot links (`lineupSongHref`) and performance-mode
    navigation.
  - No stored data, API or URL changes.

## Build steps

- [x] 1. Add `sundayTiming` to `lib/lineups.ts`, with tests in `tests/lineups.test.ts`:
  - a past date
  - today being a Sunday (upcoming)
  - a date 1–6 days ahead (upcoming)
  - exactly 7 days ahead (future)
  - month and year boundaries (e.g. today `2026-12-29`, Sunday `2027-01-03`)

  Done when `npm test` passes.
- [x] 2. In `LineupPage.tsx`, compute the local `today` in an effect and apply
  the `past`/`upcoming` classes and labels. Add the CSS in `app/globals.css`
  next to `.sunday-card`, with print overrides. Done when `npm run typecheck`
  and `npm run build` pass, and a lineup for the current month shows earlier
  Sundays dimmed with "Past" and the next Sunday highlighted with "Upcoming".

## Verify

- `npm test`, `npm run typecheck`, `npm run build`.
- Open this month's lineup:
  - Sundays before today look dimmed and say "Past".
  - The next Sunday (or today, if it's Sunday) says "Upcoming".
  - Later Sundays look unchanged.
- Open next month's lineup:
  - Only its first Sunday is marked, and only if it's within 7 days.
  - Last month's lineup is all "Past".
- Print preview shows plain cards without the labels.
- Editing a slot on a past Sunday still works.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3246,"specSha256":"104b71524321728fe8be6f3c61c6ed60eb77f260d8a43b7df413af12adbba55f","branch":"refs/heads/fix/past-and-upcoming-sundays-on-the-lineup","head":"f363b3ad870ebe0809637700af2e028501a410a7","baseRef":"refs/heads/main","baseCommit":"f363b3ad870ebe0809637700af2e028501a410a7","sourceTree":"9509beca893f8190a4557af3a13a9bbcc7e7449c","absentOptional":[]} -->
