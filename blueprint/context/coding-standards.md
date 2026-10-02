# Coding Standards

> Conventions as practiced in the Worshiply codebase, recorded by `/adopt`.
> Follow what the code already does; change a convention deliberately, not by drift.

## Next.js version

Next.js 16 has breaking changes from older versions. Before writing Next.js code,
read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation
notices rather than relying on memory.

## TypeScript

- Strict mode is on; no `any`. Use `unknown` for untrusted input and narrow it.
- Import through the `@/` alias (`@/lib/...`, `@/types/...`).
- Shared domain types live in `types/` (`types/song.ts`, `types/chord.ts`).
  `SongInput` is `Song` without server-assigned fields.
- Use `as const` arrays plus derived union types for fixed option sets
  (for example `SONG_CATEGORIES`).

## React and routing

- Functional components and hooks only.
- `app/**/page.tsx` files are thin server wrappers: they await `params` and render
  a feature component from `components/`.
- Interactive screens are client components (`"use client"`) that load and save
  data through the REST API with `lib/api.ts`.
- Show loading, empty, and error states inline (`state-panel`, `role="status"`
  feedback). There is no toast library.

## API and data access

- REST route handlers live in `app/api/**/route.ts`, declare
  `export const runtime = "nodejs"`, and use `force-dynamic` where responses are
  per-request.
- Each handler wraps its body in `try { ... } catch (error) { return apiError(error); }`.
  Throw `ApiError(status, userFacingMessage)` for expected failures.
- Mutating requests read their body with `readBody()` from `lib/server/http.ts`,
  which enforces same-origin, JSON content type, and a size limit. Keep that path
  for any new mutation.
- Validate input with the hand-written validators in `lib/server/validation.ts`
  (no Zod). Validators return a normalized, typed value or throw `ApiError(400, ...)`.
- `lib/server/db.ts` is the only data-access boundary. It uses `@libsql/client`
  with parameterized SQL, and stores the full song as JSON in a `data` column
  beside indexed columns (slug, title, artist, key, updated time, owner hash).
  Tables are created with `CREATE TABLE IF NOT EXISTS`; there is no migration tool.
- Server-only modules import `"server-only"`.
- Ownership: the `worshiply_owner` HTTP-only cookie token is checked on edit and
  delete. Only its hash is stored, and the hash never reaches the client.
- Local SQLite lives at `data/worshiply.db`. Turso is used when
  `TURSO_DATABASE_URL` is set, and local SQLite is refused on Vercel.

## Domain logic

- Chord parsing, transposition, and diagrams (`lib/chord-*.ts`) stay independent
  of React so the UI and exporters share them.
- Lyrics are stored as the original bracket-syntax source. Rendered output is
  derived and never persisted. Transposition never rewrites the stored source.
- Exporters in `lib/export/` share layout, metadata, and the export model.
  Keep PDF and Word behavior aligned when changing either.

## File organization

- Pages and API routes: `app/`
- Components: `components/` with feature folders (`editor/`, `chord-sheet/`,
  `chords/`, `export/`), PascalCase file names
- Logic and utilities: `lib/` (kebab-case files), server-only code in `lib/server/`
- Types: `types/`
- Tests: `tests/*.test.ts`, plus colocated tests such as `lib/server/validation.test.ts`

## Naming

- Components and types: PascalCase
- Functions and variables: camelCase
- Module-level constants: SCREAMING_SNAKE_CASE (`OWNER_COOKIE`, `SONG_CATEGORIES`)

## Styling

- Tailwind CSS 4 with CSS-first config: palette and font tokens in `@theme` in
  `app/globals.css`. There is no `tailwind.config.js`.
- Most styling is semantic class names (`song-view-page`, `state-panel`,
  `button`) defined in `app/globals.css`, backed by CSS custom properties on
  `:root`. Follow that pattern rather than long utility strings.
- Palette: navy `#22577a`, teal `#38a3a5`, mint `#57cc99`, lime `#80ed99`,
  pale `#c7f9cc`. Font: Noto Sans (self-hosted in `public/fonts/`).
- Anything that should not print gets `no-print`. Printed chord sheets must stay clean.
- Icons come from `lucide-react`. No component library.

## Error handling

- Server: throw `ApiError` for expected failures, and let `apiError()` map it to a
  JSON `{ error }` response. Messages are short, user-facing sentences.
- Client: `api()` throws an `Error` carrying the server's message. Catch it and
  show it inline.

## Testing

**Status: the test gate is on.** `npm test` runs unit tests with Node's built-in
test runner through `tsx --test` (`node:test` and `node:assert`). The `test`
script lists its files explicitly, so a new test file must be added to that
script or it will not run. `npm run test:api` is a separate integration check
against a running dev server. It is not a unit test and not part of the gate.

When `AGENTS.md` declares a `Verify` command, treat it as the umbrella automated
gate. It combines only the checks this project actually has, in this order when
available: typecheck, tests, then build. The command does not enable an absent
test runner or replace focused evidence. It gives local work and optional CI one
exact command to run. `/ci` owns Verify and CI setup. `/tests` adds the real test
command to Verify when it already exists, but never creates CI only because
testing was configured.

**The opt-in switch is one signal: a `test` command in the Commands section of
`AGENTS.md`.** Declare one and **tests become a gate for logic-bearing steps**,
not an optional extra; leave it out and the loop verifies logic with the evidence
it already uses (run it, a screenshot, the build). Adding the runner is itself a
deliberate step, never a silent mid-step install. This is the single definition
of the switch; the skills and `ai-interaction.md` only point back here.

- **What to test (the scope rule):** pure logic where a wrong answer is possible -
  parsers, formatters, validators, id/slug builders, server actions. These have
  assertable inputs and outputs and real edge cases (empty, missing, malformed).
- **What not to test:** UI components and integration-level surfaces (render or
  export routes, anything driving a real browser or external service). Verify those
  with a screenshot and the build, not brittle unit tests.
- **The gate (when a runner is configured):** a build step that adds in-scope logic
  must ship a passing test in the same reviewable diff. The project's test command
  must be green before the step is approved, before any checkpoint commit, and
  before `/complete` merges. UI and integration-only steps are exempt and ride on
  screenshot plus build evidence.
- **When it's named:** the `/feature` spec's Testing section predicts the coverage,
  `/implement` writes the test with the step, and if a step surfaces logic the spec
  didn't foresee, add a focused test then.
- An empty suite should fail, not pass, so "no tests ran" never looks like "passed".
- Test files live in `tests/` (for example `tests/chords.test.ts`) or next to the
  source they cover (for example `lib/server/validation.test.ts`).
- Run them via the project's test command (see Commands in `AGENTS.md`), not a
  hardcoded tool name.

Stack binding: `node:test` (default `test` export) with `node:assert/strict`, run
through `tsx`. Keep tested logic pure (chord and export helpers, validators) so
it needs no database or browser. Use `mock` from `node:test` only when a
dependency cannot be avoided.

## Browser Verification

For UI and integration behavior, prefer real browser evidence over reading the
code and assuming it works.

- Browser automation is separately opt-in through `/tests browser`. That setup
  reuses a compatible runner or prefers Playwright for supported projects, then
  documents the exact command as `Browser tests` in `AGENTS.md`.
- When `Browser tests` is declared, add focused coverage for stable behavioral
  done-whens when it is proportionate, and run the documented command during
  `/check`. Do not assume it proves visual fidelity, real authenticated-profile
  behavior, browser chrome, or another claim the test does not observe.
- If no Browser tests command is declared, do not add a runner silently in the
  middle of an unrelated feature. Use the available dev server, browser
  screenshots, build output, API output, or manual evidence instead.
- Browser tests are not part of the default Verify command or CI unless the user
  separately chooses that slower gate.
- Browser evidence is especially important for flows that click, type, submit,
  navigate, download files, render complex layouts, or depend on client-side
  state.

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible

## Comments

Write code that explains itself; comment only what the code cannot say.
Over-commenting is a common AI tell, so resist it.

- Comment the **why**, not the **what**. Delete any comment that restates the code.
- No banner/header blocks, section dividers, or step-by-step narration of obvious
  code. A file does not need a comment announcing each region.
- A comment earns its place only when it captures something the code can't: a
  non-obvious decision, a gotcha or workaround, why a value is what it is, or a
  link to a spec or issue.
- Prefer self-documenting names and small functions over explanatory comments.
- Keep doc comments minimal: a one-line purpose on an exported type or function is
  plenty; don't write JSDoc that just repeats the signature.
- When in doubt, leave the comment out.

## Writing

- No em dashes (U+2014) in generated content: docs, comments, commit messages,
  READMEs, specs. They read as AI-generated.
- Use a hyphen for `term - description` separators; rephrase prose with commas,
  parentheses, or a colon. Avoid en dashes and the ellipsis character too.
