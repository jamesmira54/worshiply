# Project Plan

> Seeded by `/adopt` from the existing codebase and a short interview. Sections 3
> and 5 describe what already exists. Correct anything marked `TODO (confirm)`,
> then run `/overview`.

## 1. Problem - What problem are we solving?

Worship teams keep chord sheets in scattered documents that are awkward to
edit, transpose, and hand out. Worshiply gives a team one place to write songs in
simple bracket chord syntax, view them as clean chord sheets in any key, share a
stable link, and export print-ready PDF or editable Word files.

## 2. Users - Who is this for?

Any church worship team or musician who prepares chord sheets: worship leaders
writing and arranging songs, and band members who view, transpose, print, or
export them. It is intended for public use by many unrelated churches, not a
single team.

## 3. Features - What does the MVP need?

Already shipped:

- Song library with search, key and category filters, sorting, and pagination
- Song editor using bracket chord syntax (`[C]One line [G/B]with chords`), song
  metadata (key, BPM, time signature, capo, notes, category), and an example song
- Chord sheet view with section headings and preserved whitespace
- Transposition of roots and slash bass notes without rewriting the stored source
- Guitar and piano chord diagrams
- Stable song URLs with numbered suffixes for duplicate titles
- Browser-cookie ownership: only the creating browser can edit or delete a song;
  everyone else can view, transpose, print, export, or copy it
- Share via native share sheet or copied link
- PDF export (jsPDF, embedded Noto Sans, A4 portrait/landscape, page numbers)
- Word export (docx, editable text, Google Docs compatible)
- Print styles that hide the editing interface

Next (see `build-plan.md`):

- Monthly song lineup (built first): for each month, every calendar Sunday gets
  4 song slots: 1 Singspiration, 2 Worship songs, and 1 Closing song. The
  Singspiration slot offers Singspiration songs, the Worship slots offer Praise &
  Worship songs, and the Closing slot accepts any song.
- Accounts, setlists, performance mode.

## 4. Data - What are we storing?

- **Songs** - one `songs` table: id, unique slug, title, artist, original key,
  updated time, an owner hash, and a JSON `data` column holding the full song
  (lyrics source, metadata, and presentation preferences such as font size,
  diagram type, chord visibility, and orientation). Generated HTML is never stored.
- **Monthly lineups** - per month, one entry per Sunday date, each with four
  song slots (Singspiration, Worship 1, Worship 2, Closing) referencing saved songs.
  > TODO (confirm): who may edit a month's lineup while ownership is cookie-only,
  > and what a slot shows if its song is deleted.
- **Ownership** - a random HTTP-only cookie token; only its hash is stored and it
  is never sent back to clients.

## 5. Tech - What stack are we using?

- Next.js 16 (App Router, Node runtime route handlers), React 19, TypeScript (strict)
- Tailwind CSS 4 theme tokens plus semantic CSS classes in `app/globals.css`
- libSQL (`@libsql/client`): local SQLite at `data/worshiply.db`, or Turso in production
- jsPDF and docx for exports, lucide-react icons, Noto Sans fonts
- npm; Node's test runner via `tsx --test`

## 6. Monetize - How will this make money?

> TODO (confirm): not discussed. Leave blank if there is no monetization plan.

## 7. UI/UX - How should this look and feel?

Clean, readable, print-first chord sheets. Blue/teal/green palette (navy
`#22577a`, teal `#38a3a5`, mint `#57cc99`, lime `#80ed99`, pale `#c7f9cc`) with
Noto Sans. The editing interface disappears when printing.

## 8. Deployment - Where and how will this ship?

- Host: Vercel, domain `https://worshiply.azelandjames.com`
- Build: `npm run build`; start: `npm run start`
- Env vars: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (required on Vercel),
  `APP_ORIGIN` (canonical origin for origin checks)
- Database: Turso; the app refuses local SQLite on Vercel. Tables are created
  automatically on first use. Use a separate database for Preview deployments.

## 9. Usage model and constraints (optional)

- Internet-facing and meant for any church team.
- All saved songs are currently publicly readable by anyone who can reach the server.
- Editing is protected only by a browser cookie, which is not account
  authentication. Clearing cookies or switching devices loses edit access.
- Mutating requests must pass same-origin checks.
- The README notes that public deployment should add a song-creation rate limit
  at the host or authentication boundary.

> TODO (confirm): expected scale, and whether songs should stay public once accounts exist.
