# Feature: Bible verse presenter

**From build-plan:** feature 18
**Build attempt:** 1
**Branch:** feature/bible-verse-presenter
**Status:** verified

## Goal

During the sermon, the operator types Bible references such as "John 3:16-18" on a
new **Bible** page and builds a list of passages. **Present** then projects the
passages one verse per slide, through the same control window and audience window
as the lyrics presenter (feature 17). The text is a public-domain KJV bundled with
the app, so there is no API key, no third-party service, and nothing new stored in
the database.

## In scope

- **Bundled KJV text:**
  - The full King James Version (66 books, 1,189 chapters, 31,102 verses) is
    served as static files, one JSON file per book, under `public/bible/kjv/`.
  - The data is downloaded once during step 1 from a public-domain source that
    the user approves first. It is then converted, cleaned and checked.
- **Reference parsing** (case-insensitive, extra spaces ignored):
  - **Forms accepted:**
    - `John 3` for a whole chapter.
    - `John 3:16` for one verse.
    - `John 3:16-18` for a verse range.
    - `John 3:16-4:2` for a range across chapters.
  - **Book names:**
    - Full names, numbered books written `1 John` or `1John`, and common
      abbreviations.
    - An unambiguous prefix of a book name works too, for example `Gen`, `Rom`
      or `Phil`, which means Philippians.
    - An ambiguous prefix such as `Ju` (Judges or Jude) gives an error.
  - **Errors** say what's wrong:
    - "We couldn't find a book called "…"."
    - "John has 21 chapters."
    - "John 3 has 36 verses."
    - "Write a reference like John 3:16-18."
- **Bible page** at `/bible`, linked as **Bible** in the header navigation and the
  ≤860px hamburger menu:
  - **Reference field:** a labelled "Bible reference" input with an **Add
    passage** button, which Enter also triggers.
    - A parse or range error shows under the field. It is linked with
      `aria-describedby` and `aria-invalid`, and clears when the input changes.
  - **Passage list:** shows each passage's canonical reference (e.g.
    "John 3:16–18"), its verse count and a preview of the first verse.
    - Each passage has a **Remove** button.
    - The list is not saved, so a reload clears it.
    - Duplicate passages are allowed.
  - **Present button:** disabled while the list is empty. It opens the presenter
    with every passage in list order.
  - **Loading:** "Loading John…" while a book file loads. Each book is fetched
    at most once per page visit.
  - **Load failure:** "Couldn't load John. Check your connection and try again."
    shows with `role="alert"`, and the passage isn't added.
  - The page is public, the same as reading songs: no sign-in is needed, and no
    new permissions are added.
- **Slides:**
  - Each verse gets one slide. It shows the verse text, with a caption under it
    such as "John 3:16 KJV".
  - Long verses auto-fit the same way as lyrics (feature 17, step 4).
  - The control window's slide list groups the slides by passage.
- **Adding passages while presenting:** the presenter control window shows the
  same "Bible reference" field. A passage added there is appended to the deck
  without closing the audience window or changing the current slide.
- **Presenter reuse:**
  - The existing `PresenterView` gains a generic deck input, used for both
    lyrics and verses.
  - All feature 17 behaviour is unchanged: keys, Blank, text size, auto-fit,
    audience-window lifecycle, wake lock and pop-up-blocked message.

## Out of scope

- Other translations, a translation switcher, or search by keyword.
- Saving passage lists, sharing them, or linking them to a lineup.
- Reordering passages (they can be removed and added again).
- Showing verses inside the lyrics presenter opened from a song or lineup.
- Footnotes, cross-references, red-letter text and the KJV italics markup (it is
  removed).

## Build loop

`workflow.stepReview` is `feature`, so the build goes through all steps, then
gives one review packet. Checkpoint commits are disabled. `/complete` makes the
feature commit.

## Build steps

- [x] 1. **Bundle the KJV text.**
  - **Find a source.** Look for a public-domain KJV in JSON or CSV with verses
    split out. Show the user the exact source URL, the format and the licence
    notes, and **get approval before downloading**.
  - **Convert it.** A conversion script in the scratchpad (not committed) writes
    `public/bible/kjv/<n>.json` for n = 1–66, in canonical book order.
    - Each file is `{ "book": "<name>", "chapters": [["verse 1", "verse 2", …], …] }`.
    - Clean each verse: remove pilcrows (`¶`) and the italics or editorial
      markup in `{}` or `[]`, keeping the words, and collapse whitespace.
  - **Check it.** Exactly 66 files, 1,189 chapters and 31,102 verses, and no
    empty verse. Spot-check John 3:16, Psalm 117 (2 verses) and 3 John (1
    chapter, 14 verses). Record the source URL and the counts in Notes for the
    AI.
  - Done when the checks print the expected counts and the files are in
    `public/bible/kjv/`.
- [x] 2. **Book list and reference parser.**
  - Add `lib/bible.ts` with:
    - `BOOKS`, holding the 66 names in order, each with its file number,
      chapter count and aliases.
    - `findBook(name)`, which returns a book or an error.
    - `parseReference(text)`, which returns
      `{ book, start: { chapter, verse? }, end?: { chapter, verse } }` or
      `{ error }`.
    - `resolvePassage(ref, chapters)`, which checks the chapter and verse
      bounds against the loaded book. It returns
      `{ reference, verses: { chapter, verse, text }[] }` or `{ error }`.
    - `formatReference(...)`, which formats a canonical reference with an en
      dash.
  - Add tests in `tests/bible.test.ts` and add the file to the `test` script.
  - Done when `npm test` passes, with tests for:
    - every accepted form and a cross-chapter range
    - `1 John` and `1John`, abbreviations, and prefixes
    - an ambiguous prefix (`Ju`), an unknown book and malformed text
    - chapter and verse out of range, and an end before the start
    - canonical formatting
    - `BOOKS` having 66 entries whose chapter counts add up to 1,189
- [x] 3. **Generic presenter deck.**
  - In `lib/presenter.ts`, rename the slide fields `songIndex`/`songTitle` to
    `groupIndex`/`groupTitle`, add a `"verse"` kind and an optional `caption`,
    and add `passageSlides(passages)`.
  - Change `PresenterView` to take `{ slides, groups, skipped?, extra?, onClose }`,
    where `extra` is an optional node rendered under the controls.
    - The audience and preview styles show the caption smaller (about 0.55em)
      under the verse text.
    - The current slide stays the same when the deck grows.
  - Update `SongPage` and `LineupPage` to pass `deckSlides(...)` and the song
    titles. Update `tests/presenter.test.ts` for the renamed fields, and add
    `passageSlides` tests (one slide per verse, captions, group order).
  - Done when typecheck and `npm test` pass and the lyrics presenter behaves as
    before.
- [x] 4. **Bible page and navigation.**
  - Add `app/bible/page.tsx`, with the metadata title "Bible", rendering
    `components/bible/BiblePage.tsx`.
  - The client page holds the reference form, the passage list, the
    per-visit book cache, and the loading and error states. It opens
    `PresenterView` with `extra` set to the same reference form.
  - Add the **Bible** link to `components/AppHeader.tsx`. It is marked active
    on `/bible`. Add styles in `app/globals.css`.
  - Done when typecheck, tests and `npm run build` pass, and `/bible` is listed
    in the build output.

- [x] 5. **Suggestions while typing** (added after review).
  - **Behaviour:** while the operator types the book part of a reference, before
    any chapter number, a list of up to 6 matching books appears under the
    "Bible reference" field. Each entry shows the book name and its chapter count,
    for example "John · 21 chapters".
    - **Matching** (case-insensitive, spaces and dots ignored):
      - books whose name or alias starts with the text come first;
      - then books with any word in the name starting with it, so `john` also
        offers 1 John, 2 John and 3 John;
      - each group is in Bible order.
    - Typing `1 j` gives 1 John only; `ps` gives Psalms.
    - Nothing is shown for an empty field or once a chapter number has been
      typed.
  - **Choosing a book:** clicking it, or pressing Enter or Tab on the highlighted
    entry, replaces the book part with the full name plus a space (e.g.
    `John `), keeps focus in the field, and closes the list. The operator then
    types `3:16`.
  - **Keyboard:**

    | Key | Action |
    | --- | --- |
    | ↓ / ↑ | Move the highlight through the list (no wrap) |
    | Enter | Picks the highlighted book; with nothing highlighted it submits the form as before |
    | Escape | Closes the list. Inside the presenter it doesn't exit the presenter (prevent the dialog's cancel) |

    The list also closes when the field loses focus.
  - **Accessibility:** use the ARIA combobox pattern:
    - the input has `role="combobox"`, `aria-autocomplete="list"`,
      `aria-expanded` and `aria-controls`;
    - the list has `role="listbox"`, with `role="option"` entries;
    - `aria-activedescendant` points at the highlighted entry;
    - each `ReferenceForm` instance gets unique ids from `useId`.
  - **Scope:** works in both forms, the one on the Bible page and the one in the
    presenter control window.
  - **Code:** add a pure `suggestBooks(text, limit = 6)` in `lib/bible.ts`, built
    on the same normalization as `findBook`, with tests in `tests/bible.test.ts`.
    The tests cover:
    - prefix before word matches
    - `john`
    - `1 j`
    - aliases (`ps`)
    - empty input
    - text with a chapter number
    - the limit

    The UI goes in `ReferenceForm` (`components/bible/BiblePage.tsx`), with
    styles in `app/globals.css`.
  - Done when `npm test`, typecheck and build pass, and typing `jo` on `/bible`
    shows Joshua, Job, Joel, John and Jonah, plus 1, 2 and 3 John if room
    allows. Picking John fills `John ` in the field.

## Files / areas

- **New:**
  - `public/bible/kjv/1.json` to `66.json`
  - `lib/bible.ts` and `tests/bible.test.ts`
  - `app/bible/page.tsx` and `components/bible/BiblePage.tsx`
- **Changed:**
  - `lib/presenter.ts`, `tests/presenter.test.ts` and
    `components/presenter/PresenterView.tsx`
  - `components/SongPage.tsx`, `components/lineups/LineupPage.tsx` and
    `components/AppHeader.tsx`
  - `app/globals.css` and `package.json` (the test script only)
- **Reused:**
  - the presenter (feature 17), its auto-fit and text-size controls, and `stepIndex`
  - the header's active-link pattern

## Data / contracts

- **No database table, API route or server code.** The book files are static
  assets served from `/bible/kjv/<n>.json` and fetched by the browser.
- **Book file:** `{ book: string; chapters: string[][] }`. `chapters[c - 1][v - 1]`
  is the text of chapter `c`, verse `v`.
- **Slide:**
  `{ kind: "title" | "lyrics" | "verse"; groupIndex: number; groupTitle: string; label?: string; lines: string[]; caption?: string }`.
- **Passages** live only in the page's React state.
- **Safe rendering:** reference input and verse text are only ever rendered as
  React text nodes. The reference is parsed against the fixed `BOOKS` list, and
  the file number comes from `BOOKS`, never from the user's text, so the fetch
  path can't be steered.

## Testing

- `npm test` covers the parser, book list, passage resolution and the presenter
  slide changes.
- `npm run typecheck` and `npm run build` must pass. `npm run test:api` is
  unaffected.
- **Manual browser checks:**
  1. On `/bible`, add "John 3:16-18" and "Ps 23", then Present. There should be
     9 slides, each with its caption.
  2. While presenting, add "Romans 5:8" from the control window. The audience
     window stays open and the new slide appears at the end.
  3. "Ju 1", "John 22" and "John 3:40" each show the right error.
  4. The header's Bible link works at desktop width and in the hamburger menu.
  5. Presenting from a song or lineup works as before.
  6. Typing `jo` lists matching books. Arrow down and press Enter to pick one,
     then type `3:16` and add it. Escape closes the list without leaving the
     presenter.

## Notes for the AI

- Read `node_modules/next/dist/docs/` for the App Router page and metadata
  conventions before adding `app/bible/page.tsx`. Follow the existing
  `app/lineups/page.tsx` pattern.
- **KJV versification:** Protestant canon, 66 books. 3 John has 14 verses in
  the KJV. Make sure the source matches the KJV counts and isn't a different
  versification.
- **Book order and names:** Genesis … Revelation. Use "Psalms" as the book name,
  but accept "Psalm" and "Ps". "Song of Solomon" also accepts "Song", "Song of
  Songs" and "SOS".
- **Book cache:** a `Map` from book number to a promise of its chapters, held in
  a ref. Delete an entry when its fetch fails, so a retry works.
- **Source and counts:** recorded after step 1.
  - The source is https://github.com/aruljohn/Bible-kjv (MIT; the KJV text is
    public domain), downloaded from
    `raw.githubusercontent.com/aruljohn/Bible-kjv/master/<Book>.json` in the order
    of its `Books.json`.
  - It checked out at 66 books, 1,189 chapters and 31,102 verses, numbered in
    sequence. It had no markup apart from 2 double spaces, which were collapsed.
  - The output is `public/bible/kjv/1..66.json` (4.2 MB).
    `tests/bible.test.ts` re-checks these counts against the files.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":13713,"specSha256":"578c8f0d973185ea58c5c0a70263af9139efc3d5d89bf2581522dcffe15ff92b","branch":"refs/heads/feature/bible-verse-presenter","head":"7fca49259ff17fd60daff5ad73b220552ffa12cb","baseRef":"refs/heads/main","baseCommit":"7fca49259ff17fd60daff5ad73b220552ffa12cb","sourceTree":"1ff37a44620c230f97761c136ccf16566ebaddfa","absentOptional":[]} -->
