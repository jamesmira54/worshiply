import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BOOKS,
  findBook,
  formatReference,
  parseReference,
  resolvePassage,
  suggestBooks,
  type Reference,
} from "../lib/bible";

const parsed = (text: string) => {
  const result = parseReference(text);
  assert.ok(!("error" in result), `${text}: ${"error" in result ? result.error : ""}`);
  return result as Reference;
};
const shape = (text: string) => {
  const { book, start, end } = parsed(text);
  return [book.name, start, end];
};
const errorOf = (result: object) => ("error" in result ? (result as { error: string }).error : "");

// A small stand-in book: 3 chapters of 4, 2 and 3 verses.
const chapters = [
  ["1a", "1b", "1c", "1d"],
  ["2a", "2b"],
  ["3a", "3b", "3c"],
];

test("the book list is the 66-book KJV canon with 1,189 chapters", () => {
  assert.equal(BOOKS.length, 66);
  assert.equal(BOOKS.reduce((sum, b) => sum + b.chapters, 0), 1189);
  assert.deepEqual([BOOKS[0].name, BOOKS[18].name, BOOKS[65].name], ["Genesis", "Psalms", "Revelation"]);
  assert.deepEqual(BOOKS.map((b) => b.number), Array.from({ length: 66 }, (_, i) => i + 1));
});

test("all four reference forms parse", () => {
  assert.deepEqual(shape("John 3"), ["John", { chapter: 3 }, undefined]);
  assert.deepEqual(shape("John 3:16"), ["John", { chapter: 3, verse: 16 }, undefined]);
  assert.deepEqual(shape("john  3 : 16 - 18"), ["John", { chapter: 3, verse: 16 }, { chapter: 3, verse: 18 }]);
  assert.deepEqual(shape("John 3:16–4:2"), ["John", { chapter: 3, verse: 16 }, { chapter: 4, verse: 2 }]);
});

test("numbered books, abbreviations, and unambiguous prefixes find the book", () => {
  for (const text of ["1 John 4:8", "1John 4:8", "I John 4:8", "First John 4:8", "1 Jn 4:8"])
    assert.equal(parsed(text).book.name, "1 John", text);
  assert.equal(parsed("Ps 23").book.name, "Psalms");
  assert.equal(parsed("Psalm 23").book.name, "Psalms");
  assert.equal(parsed("Gen 1:1").book.name, "Genesis");
  assert.equal(parsed("Rom 5:8").book.name, "Romans");
  assert.equal(parsed("Phil 4:13").book.name, "Philippians");
  assert.equal(parsed("Song 2:4").book.name, "Song of Solomon");
  assert.equal(parsed("Rev. 21:4").book.name, "Revelation");
  assert.equal(parsed("Isa 53:5").book.name, "Isaiah");
});

test("ambiguous, unknown, and malformed references explain the problem", () => {
  assert.match(errorOf(parseReference("Ju 1")), /could be Judges, Jude/);
  assert.equal(errorOf(findBook("Hezekiah")), 'We couldn\'t find a book called "Hezekiah".');
  assert.equal(errorOf(parseReference("John")), "Write a reference like John 3:16-18.");
  assert.equal(errorOf(parseReference("John 3-4")), "Write a reference like John 3:16-18.");
  assert.equal(errorOf(parseReference("3:16")), "Write a reference like John 3:16-18.");
  assert.equal(errorOf(parseReference("")), "Write a reference like John 3:16-18.");
});

test("references are formatted canonically with an en dash", () => {
  assert.equal(formatReference(parsed("john 3")), "John 3");
  assert.equal(formatReference(parsed("john 3:16")), "John 3:16");
  assert.equal(formatReference(parsed("john 3:16-18")), "John 3:16–18");
  assert.equal(formatReference(parsed("john 3:16-4:2")), "John 3:16–4:2");
  assert.equal(formatReference(parsed("john 3:16-16")), "John 3:16");
});

test("passages collect verses within and across chapters", () => {
  const ref = (text: string) => ({ ...parsed(text), book: { ...BOOKS[42] } });
  const verses = (text: string) => {
    const result = resolvePassage(ref(text), chapters);
    assert.ok(!("error" in result), text);
    return result.verses.map((v) => `${v.chapter}:${v.verse}=${v.text}`);
  };
  assert.deepEqual(verses("John 2"), ["2:1=2a", "2:2=2b"]);
  assert.deepEqual(verses("John 1:3"), ["1:3=1c"]);
  assert.deepEqual(verses("John 1:2-3"), ["1:2=1b", "1:3=1c"]);
  assert.deepEqual(verses("John 1:4-3:1"), ["1:4=1d", "2:1=2a", "2:2=2b", "3:1=3a"]);
});

test("out-of-range chapters and verses, and backwards ranges, are rejected", () => {
  const error = (text: string) => errorOf(resolvePassage(parsed(text), chapters));
  assert.equal(error("John 4"), "John has 3 chapters.");
  assert.equal(error("John 0:1"), "John has 3 chapters.");
  assert.equal(error("John 2:3"), "John 2 has 2 verses.");
  assert.equal(error("John 1:2-9"), "John 1 has 4 verses.");
  assert.equal(error("John 1:2-5:1"), "John has 3 chapters.");
  assert.equal(error("John 1:3-2"), "The end of the passage comes before its start.");
  assert.equal(error("John 3:1-1:4"), "The end of the passage comes before its start.");
  assert.equal(errorOf(resolvePassage(parsed("Jude 2"), [["only"]])), "Jude has 1 chapter.");
});

test("the bundled KJV files match the book list: 66 books, 31,102 verses", () => {
  let verses = 0;
  for (const book of BOOKS) {
    const data = JSON.parse(readFileSync(`public/bible/kjv/${book.number}.json`, "utf8")) as {
      book: string;
      chapters: string[][];
    };
    assert.equal(data.book, book.name);
    assert.equal(data.chapters.length, book.chapters, book.name);
    for (const chapter of data.chapters) {
      assert.ok(chapter.length > 0 && chapter.every((text) => text.trim() === text && text));
      verses += chapter.length;
    }
  }
  assert.equal(verses, 31102);
  const john = JSON.parse(readFileSync("public/bible/kjv/43.json", "utf8")).chapters;
  assert.match(john[2][15], /^For God so loved the world/);
});

test("book suggestions put name matches first, then later-word matches, in Bible order", () => {
  const names = (text: string, limit?: number) => suggestBooks(text, limit).map((b) => b.name);
  assert.deepEqual(names("jo"), ["Joshua", "Job", "Joel", "Jonah", "John", "1 John"]);
  assert.deepEqual(names("john"), ["John", "1 John", "2 John", "3 John"]);
  assert.deepEqual(names("1 j"), ["1 John"]);
  assert.deepEqual(names("ps"), ["Psalms"]);
  assert.deepEqual(names("sol"), ["Song of Solomon"]);
  assert.deepEqual(names("Rev."), ["Revelation"]);
  assert.deepEqual(names("jo", 3), ["Joshua", "Job", "Joel"]);
});

test("no suggestions for an empty field, unknown text, or once a chapter is typed", () => {
  assert.deepEqual(suggestBooks(""), []);
  assert.deepEqual(suggestBooks("   "), []);
  assert.deepEqual(suggestBooks("xyz"), []);
  assert.deepEqual(suggestBooks("John 3"), []);
  assert.deepEqual(suggestBooks("1 John 4:8"), []);
  assert.equal(suggestBooks("1").length, 6);
});
