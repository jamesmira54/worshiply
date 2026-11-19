// KJV book list and reference parsing. No React or DOM, so it can be tested directly.
// The text itself is static: public/bible/kjv/<number>.json, one file per book.

export type Book = { number: number; name: string; chapters: number; aliases: string[] };
export type VerseRef = { chapter: number; verse?: number };
export type Reference = {
  book: Book;
  start: VerseRef;
  end?: { chapter: number; verse: number };
};
export type PassageVerse = { chapter: number; verse: number; text: string };
export type Passage = { book: string; reference: string; verses: PassageVerse[] };

const LIST: [string, number, string[]][] = [
  ["Genesis", 50, ["gn"]], ["Exodus", 40, ["ex"]], ["Leviticus", 27, ["lv"]],
  ["Numbers", 36, ["nm", "nb"]], ["Deuteronomy", 34, ["dt"]], ["Joshua", 24, ["jos", "josh"]],
  ["Judges", 21, ["jdg", "judg"]], ["Ruth", 4, ["rth"]], ["1 Samuel", 31, ["1sm"]],
  ["2 Samuel", 24, ["2sm"]], ["1 Kings", 22, ["1kgs"]], ["2 Kings", 25, ["2kgs"]],
  ["1 Chronicles", 29, ["1chr"]], ["2 Chronicles", 36, ["2chr"]], ["Ezra", 10, []],
  ["Nehemiah", 13, []], ["Esther", 10, []], ["Job", 42, []],
  ["Psalms", 150, ["psalm", "ps", "psa", "pss"]], ["Proverbs", 31, ["prv"]],
  ["Ecclesiastes", 12, ["eccl", "qoh"]],
  ["Song of Solomon", 8, ["song", "songofsongs", "sos", "canticles"]],
  ["Isaiah", 66, []], ["Jeremiah", 52, []], ["Lamentations", 5, []],
  ["Ezekiel", 48, ["ezk"]], ["Daniel", 12, ["dn"]], ["Hosea", 14, []], ["Joel", 3, []],
  ["Amos", 9, []], ["Obadiah", 1, []], ["Jonah", 4, ["jon"]], ["Micah", 7, []],
  ["Nahum", 3, []], ["Habakkuk", 3, []], ["Zephaniah", 3, []], ["Haggai", 2, []],
  ["Zechariah", 14, []], ["Malachi", 4, []], ["Matthew", 28, ["mt"]], ["Mark", 16, ["mk", "mrk"]],
  ["Luke", 24, ["lk"]], ["John", 21, ["jn", "jhn"]], ["Acts", 28, []], ["Romans", 16, ["rm"]],
  ["1 Corinthians", 16, []], ["2 Corinthians", 13, []], ["Galatians", 6, []],
  ["Ephesians", 6, []], ["Philippians", 4, ["phil", "php"]], ["Colossians", 4, []],
  ["1 Thessalonians", 5, []], ["2 Thessalonians", 3, []], ["1 Timothy", 6, []],
  ["2 Timothy", 4, []], ["Titus", 3, []], ["Philemon", 1, ["phm", "philem"]],
  ["Hebrews", 13, []], ["James", 5, ["jas"]], ["1 Peter", 5, ["1pt"]], ["2 Peter", 3, ["2pt"]],
  ["1 John", 5, ["1jn"]], ["2 John", 1, ["2jn"]], ["3 John", 1, ["3jn"]], ["Jude", 1, ["jud"]],
  ["Revelation", 22, ["rev", "revelations"]],
];

export const BOOKS: Book[] = LIST.map(([name, chapters, aliases], i) => ({
  number: i + 1,
  name,
  chapters,
  aliases,
}));

const FORMAT_ERROR = "Write a reference like John 3:16-18.";

/** Lowercase, drop spaces and dots, and turn a leading I/II/III or First/Second/Third into 1/2/3. */
function normalize(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/^(iii|third)\s+/, "3")
    .replace(/^(ii|second)\s+/, "2")
    .replace(/^(i|first)\s+/, "1")
    .replace(/[\s.]+/g, "");
}

const KEYS = BOOKS.map((book) => ({ book, key: normalize(book.name) }));

export function findBook(name: string): { book: Book } | { error: string } {
  const key = normalize(name);
  const shown = name.trim();
  if (!key) return { error: FORMAT_ERROR };
  const exact = KEYS.find((entry) => entry.key === key || entry.book.aliases.includes(key));
  if (exact) return { book: exact.book };
  const matches = KEYS.filter((entry) => entry.key.startsWith(key));
  if (matches.length === 1) return { book: matches[0].book };
  if (matches.length > 1)
    return {
      error: `"${shown}" could be ${matches.map((m) => m.book.name).join(", ")}. Type more of the name.`,
    };
  return { error: `We couldn't find a book called "${shown}".` };
}

/** Books to suggest while the book part of a reference is typed: names or aliases
 * starting with the text first, then books with a later word starting with it
 * ("john" also offers 1-3 John). Each group keeps Bible order. Nothing once a
 * chapter number follows the name. */
export function suggestBooks(text: string, limit = 6): Book[] {
  if (/[a-z].*\d/i.test(text)) return [];
  const key = normalize(text);
  if (!key) return [];
  const starts = KEYS.filter(
    ({ book, key: name }) => name.startsWith(key) || book.aliases.some((a) => a.startsWith(key)),
  ).map((entry) => entry.book);
  const words = KEYS.filter(
    ({ book }) =>
      !starts.includes(book) &&
      book.name
        .toLowerCase()
        .split(" ")
        .slice(1)
        .some((word) => word.startsWith(key)),
  ).map((entry) => entry.book);
  return [...starts, ...words].slice(0, limit);
}

/** Accepts "John 3", "John 3:16", "John 3:16-18" and "John 3:16-4:2". */
export function parseReference(text: string): Reference | { error: string } {
  const match =
    /^((?:[1-3]\s*)?[a-z][a-z .]*?)\s*(\d+)(?:\s*:\s*(\d+)(?:\s*[-–—]\s*(\d+)(?:\s*:\s*(\d+))?)?)?$/i.exec(
      text.trim().replace(/\s+/g, " "),
    );
  if (!match) return { error: FORMAT_ERROR };
  const found = findBook(match[1]);
  if ("error" in found) return found;
  const [, , chapter, verse, to, toVerse] = match;
  const start: VerseRef = { chapter: Number(chapter) };
  if (verse === undefined) return { book: found.book, start };
  start.verse = Number(verse);
  if (to === undefined) return { book: found.book, start };
  const end =
    toVerse === undefined
      ? { chapter: start.chapter, verse: Number(to) }
      : { chapter: Number(to), verse: Number(toVerse) };
  return { book: found.book, start, end };
}

export function formatReference(reference: Reference) {
  const { book, start, end } = reference;
  const first = start.verse === undefined ? `${start.chapter}` : `${start.chapter}:${start.verse}`;
  if (!end || (end.chapter === start.chapter && end.verse === start.verse))
    return `${book.name} ${first}`;
  const last = end.chapter === start.chapter ? `${end.verse}` : `${end.chapter}:${end.verse}`;
  return `${book.name} ${first}–${last}`;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Check the reference against the book's text and collect its verses. */
export function resolvePassage(reference: Reference, chapters: string[][]): Passage | { error: string } {
  const { book, start, end } = reference;
  const chapterError = { error: `${book.name} has ${plural(chapters.length, "chapter")}.` };
  const verseError = (chapter: number) => ({
    error: `${book.name} ${chapter} has ${plural(chapters[chapter - 1].length, "verse")}.`,
  });
  const inBook = (chapter: number) => chapter >= 1 && chapter <= chapters.length;
  const inChapter = (chapter: number, verse: number) =>
    verse >= 1 && verse <= chapters[chapter - 1].length;

  if (!inBook(start.chapter)) return chapterError;
  if (start.verse === undefined) {
    return {
      book: book.name,
      reference: formatReference(reference),
      verses: chapters[start.chapter - 1].map((text, i) => ({
        chapter: start.chapter,
        verse: i + 1,
        text,
      })),
    };
  }
  if (!inChapter(start.chapter, start.verse)) return verseError(start.chapter);
  const last = end ?? { chapter: start.chapter, verse: start.verse };
  if (!inBook(last.chapter)) return chapterError;
  if (!inChapter(last.chapter, last.verse)) return verseError(last.chapter);
  if (last.chapter < start.chapter || (last.chapter === start.chapter && last.verse < start.verse))
    return { error: "The end of the passage comes before its start." };

  const verses: PassageVerse[] = [];
  for (let chapter = start.chapter; chapter <= last.chapter; chapter++) {
    const from = chapter === start.chapter ? start.verse : 1;
    const to = chapter === last.chapter ? last.verse : chapters[chapter - 1].length;
    for (let verse = from; verse <= to; verse++)
      verses.push({ chapter, verse, text: chapters[chapter - 1][verse - 1] });
  }
  return { book: book.name, reference: formatReference(reference), verses };
}
