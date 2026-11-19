"use client";
import { useId, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { BookOpen, Plus, Presentation, Trash2 } from "lucide-react";
import {
  parseReference,
  resolvePassage,
  suggestBooks,
  type Book,
  type Passage,
} from "@/lib/bible";
import { passageSlides } from "@/lib/presenter";
import { PresenterView } from "@/components/presenter/PresenterView";

type LoadBook = (book: Book) => Promise<string[][]>;
type Entry = { id: number; passage: Passage };

/** "Bible reference" field: parses, loads the book, and hands back a passage. */
function ReferenceForm({ loadBook, onAdd }: { loadBook: LoadBook; onAdd: (passage: Passage) => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = useMemo(() => suggestBooks(text), [text]);
  const showList = listOpen && suggestions.length > 0;
  const listId = `${id}-books`;
  const optionId = (i: number) => `${id}-book-${i}`;

  function pick(book: Book) {
    setText(`${book.name} `);
    setError("");
    setListOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if ((event.key === "Enter" || event.key === "Tab") && active >= 0) {
      event.preventDefault();
      pick(suggestions[active]);
    } else if (event.key === "Escape") {
      // Close the list only; inside the presenter this must not exit it.
      event.preventDefault();
      event.stopPropagation();
      setListOpen(false);
      setActive(-1);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    const reference = parseReference(text);
    if ("error" in reference) {
      setError(reference.error);
      return;
    }
    setError("");
    setLoading(reference.book.name);
    let chapters: string[][];
    try {
      chapters = await loadBook(reference.book);
    } catch {
      setError(`Couldn't load ${reference.book.name}. Check your connection and try again.`);
      return;
    } finally {
      setLoading("");
    }
    const passage = resolvePassage(reference, chapters);
    if ("error" in passage) {
      setError(passage.error);
      return;
    }
    onAdd(passage);
    setText("");
    setListOpen(false);
  }

  return (
    <form className="reference-form" onSubmit={(e) => void submit(e)}>
      <label htmlFor={`${id}-input`}>Bible reference</label>
      <div className="reference-row">
        <div className="reference-combobox">
          <input
            id={`${id}-input`}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={listId}
            aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
              setListOpen(true);
              setActive(-1);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setListOpen(false)}
            placeholder="John 3:16-18"
            autoComplete="off"
            maxLength={60}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          <ul
            id={listId}
            role="listbox"
            aria-label="Books"
            className="reference-suggestions"
            hidden={!showList}
          >
            {showList &&
              suggestions.map((book, i) => (
                <li
                  key={book.number}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  // Keep focus in the field so the click lands and typing continues.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(book)}
                >
                  {book.name}
                  <span>
                    {book.chapters} {book.chapters === 1 ? "chapter" : "chapters"}
                  </span>
                </li>
              ))}
          </ul>
        </div>
        <button className="button primary" disabled={!!loading || !text.trim()}>
          <Plus size={16} /> Add passage
        </button>
      </div>
      {loading && (
        <p className="reference-status" role="status">
          Loading {loading}…
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function BiblePage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [presenting, setPresenting] = useState(false);
  const nextId = useRef(1);
  const presentButton = useRef<HTMLButtonElement>(null);
  // One fetch per book per visit; a failed fetch is forgotten so it can be retried.
  const books = useRef(new Map<number, Promise<string[][]>>());

  const loadBook: LoadBook = (book) => {
    const cached = books.current.get(book.number);
    if (cached) return cached;
    const request = fetch(`/bible/kjv/${book.number}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ chapters: string[][] }>;
      })
      .then((data) => data.chapters);
    books.current.set(book.number, request);
    request.catch(() => books.current.delete(book.number));
    return request;
  };

  function add(passage: Passage) {
    setEntries((list) => [...list, { id: nextId.current++, passage }]);
  }

  const slides = useMemo(() => passageSlides(entries.map((e) => e.passage)), [entries]);
  const groups = useMemo(() => entries.map((e) => e.passage.reference), [entries]);

  function stopPresenting() {
    setPresenting(false);
    requestAnimationFrame(() => presentButton.current?.focus());
  }

  return (
    <main className="song-view-page bible-page">
      <div className="page-heading">
        <div>
          <h1>Bible</h1>
          <p>Line up the passages for the sermon, then present them one verse at a time (KJV).</p>
        </div>
        <div className="page-actions">
          <button
            ref={presentButton}
            className="button primary"
            disabled={entries.length === 0}
            onClick={() => setPresenting(true)}
          >
            <Presentation size={16} /> Present
          </button>
        </div>
      </div>
      <ReferenceForm loadBook={loadBook} onAdd={add} />
      {entries.length === 0 ? (
        <p className="passage-empty">
          <BookOpen size={18} /> No passages yet. Add a reference like John 3:16-18 or Psalm 23.
        </p>
      ) : (
        <ol className="passage-list" aria-label="Passages">
          {entries.map(({ id, passage }) => (
            <li key={id} className="passage-item">
              <div>
                <strong>{passage.reference}</strong>{" "}
                <span className="passage-count">
                  {passage.verses.length} {passage.verses.length === 1 ? "verse" : "verses"}
                </span>
                <p className="passage-preview">{passage.verses[0].text}</p>
              </div>
              <button
                className="icon-button"
                aria-label={`Remove ${passage.reference}`}
                onClick={() => setEntries((list) => list.filter((e) => e.id !== id))}
              >
                <Trash2 size={17} />
              </button>
            </li>
          ))}
        </ol>
      )}
      {presenting && slides.length > 0 && (
        <PresenterView
          slides={slides}
          groups={groups}
          extra={<ReferenceForm loadBook={loadBook} onAdd={add} />}
          onClose={stopPresenting}
        />
      )}
    </main>
  );
}
