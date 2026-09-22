# Worshiply

A Next.js App Router application for writing, sharing, transposing, and exporting church chord sheets. Uses TypeScript, Tailwind CSS 4, and the supplied blue/teal/green palette.

## Run locally

Requires Node.js 20.9+ and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. The library begins empty; **New song → Try an example** loads an original demonstration arrangement. Save is independent from export. A saved song receives a stable URL such as `/songs/a-song-for-the-morning`; duplicate titles receive numbered suffixes.

```sh
npm test
npm run typecheck
npm run build
npm start
```

## Architecture

- `types/song.ts` defines the persisted source and presentation preferences. Lyrics remain original editable bracket syntax; generated HTML is never stored.
- `lib/chord-parser.ts`, `lib/chord-transposer.ts`, and `lib/chord-diagrams.ts` are independent of React.
- `components/editor/` owns the editing workflow, metadata, and controls. `components/chord-sheet/` renders the same normalized data used by the exporters.
- `lib/server/db.ts` provides the data-access boundary. Route handlers validate inputs, check ownership and request origins, and never send ownership hashes to clients.
- `lib/export/` shares wrapping, metadata, chord parsing, and diagram data across exporters. **jsPDF** creates selectable PDF text with embedded Noto Sans fonts; **docx** creates editable Word text and fixed-width chord/lyric cells, readable by Google Docs. Only the instrument diagrams are raster images.

## Persistence and sharing

Songs persist in `data/worshiply.db`, outside source control. Restarting the server does not erase them. Back up this file before moving the application. Optional `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` use the same repository with remote storage; see `.env.example`.

All saved songs in this MVP are publicly readable by people who can reach the server. A random, HTTP-only, same-site cookie grants edit/delete access only to the browser that created a song. A visitor may view, transpose temporarily, print, export, or create a separate copy. This is a minimal ownership mechanism, **not team account authentication**: clearing cookies loses edit access, and cross-device editing needs an authentication provider and an owner-account mapping. Add those before using this as a private or access-controlled team library. Public deployment should also add a creation rate limit at the host or authentication boundary.

For access beyond this computer, deploy the Next.js Node server to a host with persistent storage or configure Turso. `localhost` links are for local preview only. Set `APP_ORIGIN` to the deployed HTTPS origin. Do not deploy a local SQLite database to an ephemeral serverless filesystem. No cloud services, production database, or deployment are provisioned by this repository.

## Music and documents

- Place chords immediately before lyric anchors: `[C]One line [G/B]with chords`.
- Section headings include Verse, Chorus, Pre-Chorus, Bridge, Intro, Instrumental, Outro, and Repeat Chorus. Blank lines and lyric whitespace are preserved.
- Transposition changes roots and slash bass notes while preserving modifiers. It does not rewrite the stored source. Changing an original key declares the source key; it is not a chord conversion.
- Common guitar voicings and movable major/minor/seventh shapes are supplied; unsupported voicings display an explicit unavailable message. Piano diagrams highlight pitch classes, not prescribed fingering or octave inversions.
- PDF and Word use A4 portrait/landscape layouts with measured wrapping, editable text, and page numbering. Noto Sans covers Latin, Greek, and Cyrillic text; additional script-specific fonts are needed for other writing systems. Word/Google Docs may substitute fonts if Noto Sans is not installed, so exact pagination may differ from the PDF.
- Print styles remove the entire editing interface. Browser print headers/footers are controlled by the print dialog.

## Verification

Unit tests cover parsing and whitespace, slash/modifier transposition, unique chords, guitar/piano pitch data, export wrapping, editable DOCX structure, PDF pagination, filename sanitization, and API validation. The implementation was also checked through the running API for persistence, slug collisions, search/filter, owner-only changes, cross-origin rejection, and cleanup.

With the local server running, `npm run test:api` repeats the API checks using temporary QA songs and deletes only the records it creates.

Noto Sans fonts are redistributed under the SIL Open Font License in `public/fonts/OFL.txt`.
