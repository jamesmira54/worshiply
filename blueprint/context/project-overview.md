# Worshiply - Project Overview

<!-- blueprint:source-hash 71819fa89bc7d5bf3e7fb12875cff37e77110c4df1f1f27e08b0736c8f1d1963 -->

> A web app where church worship teams write, transpose, share, print, and export chord sheets.

## Problem

Worship teams keep chord sheets in scattered documents that are awkward to edit,
transpose, and hand out. Worshiply gives a team one place to write songs in
bracket chord syntax, view them as clean chord sheets in any key, share a stable
link, and export print-ready PDF or editable Word files.

## Users

Public use by many unrelated churches, not a single team.

- **Worship leaders** - write and arrange songs, set keys and metadata, edit and delete their own songs.
- **Band members and other visitors** - view, transpose temporarily, print, export, or copy any song.

Access tiers today: anyone can read every song. Only the creating browser (cookie) can edit or delete.

## Usage model

- Internet-facing, open to any church team.
- All saved songs are publicly readable by anyone who can reach the server.
- Edit access is a browser cookie, not account authentication. It is lost if
  cookies are cleared or the device changes.
- Mutating requests must pass same-origin checks (`APP_ORIGIN` pins the origin in deployment).
- Public deployment should add a song-creation rate limit at the host or auth boundary.

## Features

Items 1-11 shipped before Blueprint adoption. **Headline:** the chord sheet
editor and view (2-3), with export (9-10).

1. [x] **Song persistence** - libSQL storage (local SQLite or Turso) with stable, collision-safe slugs.
2. [x] **Song editor** - bracket chord syntax (`[C]One line [G/B]with chords`), metadata, section headings, example song.
3. [x] **Chord sheet view** - rendered song with sections and preserved whitespace.
4. [x] **Song library** - search, key and category filters, sorting, pagination.
5. [x] **Transposition** - view in another key; roots and slash bass notes change, stored source does not.
6. [x] **Chord diagrams** - guitar voicings and piano pitch-class diagrams.
7. [x] **Cookie ownership** - creator-only edit and delete, same-origin checks on changes.
8. [x] **Sharing** - native share sheet or copied song link.
9. [x] **PDF export** - A4 portrait/landscape, embedded Noto Sans, page numbers.
10. [x] **Word export** - editable DOCX, readable by Google Docs.
11. [x] **Print styles** - print the chord sheet without the editing interface.
15. [ ] **Monthly song lineup** - every calendar Sunday of a month gets 4 slots: Singspiration, Worship x2, Closing. **Next** (added later, built first).
12. [ ] **Accounts** - real sign-in so ownership works across devices, replacing cookie-only ownership.
13. [ ] **Setlists** - group songs into a service setlist with per-song keys, shared or exported as one document.
14. [ ] **Performance mode** - full-screen, large-text or auto-scroll view for playing live.

## Data model

### Song (table `songs`)

Stored columns (indexed on `updated_at DESC` and `original_key`):

- `id` (text, primary key)
- `slug` (text, unique) - public URL identity; duplicate titles get numbered suffixes
- `title`, `artist`, `original_key` (text) - queryable copies for list and filter
- `updated_at` (text, ISO timestamp)
- `owner_hash` (text) - SHA-256 of the owner cookie token; never sent to clients
- `data` (text, JSON) - the full `Song` document below

`Song` document (`types/song.ts`):

- `id`, `slug`, `title`, `artist` (string)
- `category` (`"Praise & Worship" | "Singspiration" | "Hymnal"`, default Praise & Worship)
- `lyrics` (string) - original bracket-syntax source; rendered HTML is never stored
- `originalKey`, `defaultKey` (string) - declared source key and preferred display key
- `bpm`, `timeSignature`, `capo`, `notes` (string)
- `chordDiagramType` (`"guitar" | "piano" | "both" | "none"`)
- `fontSize` (number), `showChords` (boolean), `orientation` (`"portrait" | "landscape"`)
- `createdAt`, `updatedAt` (string, ISO)

`SongInput` is `Song` without `id`, `slug`, `createdAt`, `updatedAt`.

### Monthly lineup (feature 15, not built)

- Month (year + month) -> one Sunday per calendar Sunday (4 or 5, by date)
- Sunday -> four slots referencing a saved Song by `id`:
  - `singspiration` - Song with category Singspiration
  - `worship1`, `worship2` - Songs with category Praise & Worship
  - `closing` - any Song
- Slot pickers filter by the category above. Empty slots are allowed while planning.

> TODO: storage shape (new table vs JSON per month), who may edit while
> ownership is cookie-only, and what a slot shows if its song is deleted.
> `/feature 15` decides these.

### Ownership

- `worshiply_owner` cookie: random 64-hex token, HTTP-only, same-site lax, 5-year lifetime.
- One token can own many songs, and a song has exactly one owner hash.

> Locked: the stored lyrics source format and the slug-as-URL contract. Exports,
> transposition, and shared links depend on them. Features 15, 12, and 13 will need new
> tables (lineups, users, setlists) and a mapping from existing owner hashes to accounts.
> Their shape is not specified yet.

## Tech stack

- **Next.js 16** (App Router) - pages plus REST route handlers on the Node runtime
- **React 19 + TypeScript (strict)** - client components for interactive screens
- **Tailwind CSS 4** - `@theme` tokens plus semantic classes in `app/globals.css`
- **libSQL (`@libsql/client`)** - local SQLite at `data/worshiply.db`, or Turso in production
- **jsPDF / docx** - PDF and Word export; **Noto Sans** fonts embedded
- **lucide-react** - icons
- **npm**, Node test runner via `tsx --test`

## Monetization

> TODO: not decided. The plan leaves this open.

## UI/UX

Clean, readable, print-first chord sheets. Palette: navy `#22577a`, teal
`#38a3a5`, mint `#57cc99`, lime `#80ed99`, pale `#c7f9cc`. Font: Noto Sans. The
editing interface is hidden when printing.

- `/` - redirects to `/songs`
- `/songs` - library with search, filters, sort
- `/songs/new` - create a song (includes "Try an example")
- `/songs/[slug]` - chord sheet view, transpose, share, export, print
- `/songs/[slug]/edit` - editor (owner only)
- Monthly lineup screen - route not decided (feature 15)
- `GET/POST /api/songs`, `GET/PATCH/DELETE /api/songs/[slug]` - JSON API

## Deployment

- **Host:** Vercel, domain `https://worshiply.azelandjames.com`
- **Build / start:** `npm run build` / `npm run start`
- **Env vars:** `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (required on Vercel), `APP_ORIGIN`
- **Database:** Turso. The app refuses local SQLite on Vercel. Tables are created
  on first use, and there is no migration tool. Use a separate database for Preview.
- No workers, cron jobs, or health-check path are defined.

## Open questions

- Monetization is undecided (project-plan section 6).
- Expected scale is unknown, and so is whether songs stay public once accounts
  exist (section 9). This decides the scope of feature 12.
- Feature 15: edit permissions under cookie-only ownership, and deleted-song handling.
- The order of features 12-14 is unconfirmed. Setlists and performance mode do
  not obviously depend on accounts.
