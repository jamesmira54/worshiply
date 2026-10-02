# Build Plan

List the features that make up your project, high level and in rough build order.
Keep each item to one line; the details come later in `/feature`.

Run `/feature` to spec the next unchecked item, or `/feature 12` to pick one.
Keep completed items checked and append new features as the project grows.
Do not renumber completed features; their archived specs refer to those IDs.

## Your features

Items 1-11 shipped before the Blueprint was adopted.

- [x] 1. **Song persistence** - libSQL storage (local SQLite or Turso) with stable, collision-safe song slugs
- [x] 2. **Song editor** - bracket chord syntax, metadata fields, section headings, and an example song
- [x] 3. **Chord sheet view** - rendered song page with sections and preserved whitespace
- [x] 4. **Song library** - search, key and category filters, sorting, and pagination
- [x] 5. **Transposition** - change key for viewing without rewriting the stored source
- [x] 6. **Chord diagrams** - guitar voicings and piano pitch-class diagrams
- [x] 7. **Cookie ownership** - creator-only edit and delete, same-origin checks on changes
- [x] 8. **Sharing** - native share or copied song link
- [x] 9. **PDF export** - A4 portrait/landscape with embedded fonts and page numbers
- [x] 10. **Word export** - editable DOCX readable by Google Docs
- [x] 11. **Print styles** - print the chord sheet without the editing interface
- [x] 15. **Monthly song lineup** - plan each month's Sundays (every Sunday on the calendar), assigning 4 songs per Sunday: 1 Singspiration, 2 Worship (Praise & Worship), and 1 Closing (any category); slot pickers filter by category
- [ ] 12. **Accounts** - real sign-in so song ownership works across devices, replacing cookie-only ownership
- [ ] 13. **Setlists** - group songs into a service setlist with per-song keys, shared or exported as one document
- [ ] 14. **Performance mode** - full-screen, large-text or auto-scroll view for playing live

Item 15 was added after 12-14 and is built first. Build order follows list order, not ID.

> TODO (confirm): the order of items 12-14. Setlists and performance mode could come before accounts.
