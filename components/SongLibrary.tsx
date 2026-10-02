"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Music2,
  ArrowUpRight,
  Copy,
  Trash2,
  PenLine,
  ChevronLeft,
  ChevronRight,
  Library,
  X,
} from "lucide-react";
import { SONG_CATEGORIES } from "@/types/song";
import { DismissibleDetails } from "./DismissibleDetails";
import type { Song } from "@/types/song";
import { api } from "@/lib/api";
import { KEY_OPTIONS } from "@/components/editor/EditorToolbar";
import { ShareMenu } from "./ShareMenu";
import { ExportMenu } from "./export/ExportMenu";
import { ConfirmDialog } from "./ConfirmDialog";

type LibrarySong = Song & { canEdit: boolean };
type Result = {
  songs: LibrarySong[];
  total: number;
  page: number;
  pageSize: number;
};
export function SongLibrary() {
  const router = useRouter();
  const [data, setData] = useState<Result>({
    songs: [],
    total: 0,
    page: 1,
    pageSize: 12,
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [key, setKey] = useState("");
  const [sort, setSort] = useState("updated");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState("");
  const [deleting, setDeleting] = useState<LibrarySong | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      api<Result>(
        `/api/songs?${new URLSearchParams({ search, key, category, sort, page: String(page) })}`,
        { signal: controller.signal },
      )
        .then(setData)
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, key, category, sort, page, revision]);
  async function duplicate(song: Song) {
    setBusy(song.id);
    setError("");
    try {
      const result = await api<{ song: Song }>("/api/songs", {
        method: "POST",
        body: JSON.stringify({
          ...song,
          title: `${song.title} (copy)`.slice(0, 160),
        }),
      });
      router.push(`/songs/${result.song.slug}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not duplicate song.");
    } finally {
      setBusy("");
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(deleting.id);
    try {
      await api(`/api/songs/${deleting.slug}`, { method: "DELETE" });
      setDeleting(null);
      if (data.songs.length === 1 && page > 1) setPage(page - 1);
      else setRevision((n) => n + 1);
    } catch (e) {
      setDeleting(null);
      setError(e instanceof Error ? e.message : "Could not delete song.");
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="library-page">
      <div className="library-heading">
        <div>
          <div className="eyebrow">
            <span /> YOUR TEAM’S SONGBOOK
          </div>
          <h1>
            A place for every song<span>.</span>
          </h1>
          <p>Your chords, your arrangements, ready for the next gathering.</p>
        </div>
        <Link href="/songs/new" className="button primary">
          <Plus size={19} /> New song
        </Link>
      </div>
      <div className="library-banner">
        <div className="banner-icon">
          <Music2 size={28} strokeWidth={1.5} />
        </div>
        <div>
          <h2>From the first chord to the final amen.</h2>
          <p>Write it. Make it yours. Share it with your team.</p>
        </div>
        <Link href="/songs/new">
          Create a chord sheet <ArrowUpRight size={18} />
        </Link>
        <div className="staff-lines" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <Music2 />
        </div>
      </div>
      <div className="library-section-title">
        <h2>
          <Library size={20} /> Song library{" "}
          <span className="count-badge">{data.total}</span>
        </h2>
        <span>Ready when you are.</span>
      </div>
      <div className="library-filters">
        <label className="search-field">
          <Search size={18} />
          <span className="sr-only">Search songs or artists</span>
          <input
            placeholder="Search songs or artists…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
            >
              <X size={16} />
            </button>
          )}
        </label>
        <label className="filter-select">
          <span>Key</span>
          <select
            aria-label="Filter by key"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All keys</option>
            {KEY_OPTIONS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="filter-select">
          <span>Category</span>
          <select aria-label="Filter by category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="">All categories</option>
            {SONG_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="filter-select">
          <span>Sort</span>
          <select
            aria-label="Sort songs"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="updated">Recently updated</option>
            <option value="title">Alphabetically</option>
          </select>
        </label>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button onClick={() => setRevision((n) => n + 1)}>Retry</button>
        </div>
      )}
      {loading ? (
        <div className="song-grid" aria-label="Loading songs" role="status">
          {[1, 2, 3].map((i) => (
            <div className="song-card skeleton" key={i}>
              <div />
              <div />
              <div />
            </div>
          ))}
        </div>
      ) : data.songs.length ? (
        <>
          <div className="song-grid">
            {data.songs.map((song, index) => (
              <article className="song-card" key={song.id}>
                <div className="song-card-top">
                  <span className={`song-art tone-${index % 3}`}>
                    <Music2 size={24} strokeWidth={1.5} />
                  </span>
                  <span className="key-badge">{song.defaultKey}</span>
                </div>
                <Link className="song-title-link" href={`/songs/${song.slug}`}>
                  <h3>{song.title}</h3>
                  <ArrowUpRight size={18} />
                </Link>
                <p className="song-artist">
                  {song.artist || "Your arrangement"}
                </p>
                <p className="song-category">{song.category}</p>
                <div className="song-card-details">
                  <span>{song.bpm ? `${song.bpm} BPM` : "Free tempo"}</span>
                  <span>·</span>
                  <span>{song.timeSignature || "No time signature"}</span>
                </div>
                <div className="song-updated">
                  Updated{" "}
                  {new Intl.DateTimeFormat("en", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date(song.updatedAt))}
                </div>
                <div className="song-card-actions">
                  <Link className="button quiet" href={`/songs/${song.slug}`}>
                    Open song <ArrowUpRight size={15} />
                  </Link>
                  <DismissibleDetails className="card-menu">
                    <summary
                      className="icon-button"
                      aria-label={`Actions for ${song.title}`}
                    >
                      •••
                    </summary>
                    <div className="menu-popover">
                      {song.canEdit && (
                        <Link href={`/songs/${song.slug}/edit`}>
                          <PenLine size={15} /> Edit song
                        </Link>
                      )}
                      <button
                        disabled={busy === song.id}
                        onClick={() => void duplicate(song)}
                      >
                        <Copy size={15} /> Duplicate
                      </button>
                      <ShareMenu slug={song.slug} title={song.title} />
                      <ExportMenu song={song} allowPrint={false} />
                      {song.canEdit && (
                        <button
                          className="danger-text"
                          onClick={() => setDeleting(song)}
                        >
                          <Trash2 size={15} /> Delete
                        </button>
                      )}
                    </div>
                  </DismissibleDetails>
                </div>
              </article>
            ))}
          </div>
          <div className="pagination">
            <span>
              {(page - 1) * data.pageSize + 1}–
              {Math.min(page * data.pageSize, data.total)} of {data.total} songs
            </span>
            <div>
              <button
                className="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <button
                className="button"
                disabled={page * data.pageSize >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-library">
          <span className="empty-icon">
            <Music2 size={32} strokeWidth={1.4} />
          </span>
          <h2>
            {search || key || category
              ? "No songs match just yet."
              : "Your next gathering starts with a song."}
          </h2>
          <p>
            {search || key || category
              ? "Try a different title, artist, key, or category."
              : "Create your first chord sheet and build a songbook your team can share."}
          </p>
          {search || key || category ? (
            <button
              className="button"
              onClick={() => {
                setSearch("");
                setKey("");
                setCategory("");
                setPage(1);
              }}
            >
              Clear filters
            </button>
          ) : (
            <Link className="button primary" href="/songs/new">
              <Plus size={17} /> Create your first song
            </Link>
          )}
          <div className="empty-footnote">
            Live chord preview <span>·</span> Easy transposition <span>·</span>{" "}
            PDF & Word exports
          </div>
        </div>
      )}
      <footer className="library-footer">
        <span className="brand-small">worshiply.</span>
        <span>Less formatting. More making music together.</span>
      </footer>
      {deleting && (
        <ConfirmDialog
          title={`Delete “${deleting.title}”?`}
          onCancel={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <p>
            This removes the saved song and its shared page. This cannot be
            undone.
          </p>
          <div className="page-actions">
            <button
              autoFocus
              className="button"
              disabled={!!busy}
              onClick={() => setDeleting(null)}
            >
              Keep song
            </button>
            <button
              className="button danger"
              disabled={!!busy}
              onClick={() => void remove()}
            >
              {busy ? "Deleting…" : "Delete song"}
            </button>
          </div>
        </ConfirmDialog>
      )}
    </main>
  );
}
