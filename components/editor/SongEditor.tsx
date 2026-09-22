"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Music2,
  FileText,
  Eye,
  Printer,
  Check,
} from "lucide-react";
import type { Song, SongInput } from "@/types/song";
import { blankSong } from "@/lib/song-defaults";
import { api } from "@/lib/api";
import { SongMetadata } from "./SongMetadata";
import { LyricsEditor } from "./LyricsEditor";
import { ChordSheet } from "@/components/chord-sheet/ChordSheet";
import { ExportMenu } from "@/components/export/ExportMenu";

export function SongEditor({ slug }: { slug?: string }) {
  const router = useRouter();
  const [song, setSong] = useState<SongInput>(blankSong);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<"editor" | "preview">("editor");
  const [draft, setDraft] = useState<SongInput | null>(null);
  const [allowed, setAllowed] = useState(!slug);
  useEffect(() => {
    const controller = new AbortController();
    if (slug)
      api<{ song: Song; canEdit: boolean }>(
        `/api/songs/${encodeURIComponent(slug)}`,
        { signal: controller.signal },
      )
        .then((data) => {
          if (!data.canEdit) {
            setError(
              "This song can only be edited from the browser that created it. You can make your own copy from its song page.",
            );
            return;
          }
          setAllowed(true);
          setSong(data.song);
        })
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        })
        .finally(() => setLoading(false));
    try {
      const saved = localStorage.getItem(`worshiply-draft:${slug || "new"}`);
      if (saved) setDraft(JSON.parse(saved));
    } catch {
      /* Storage may be disabled. Saving to the server still works. */
    }
    return () => controller.abort();
  }, [slug]);
  useEffect(() => {
    if (!dirty) return;
    try {
      localStorage.setItem(
        `worshiply-draft:${slug || "new"}`,
        JSON.stringify(song),
      );
    } catch {
      /* Best-effort draft recovery. */
    }
    const protect = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", protect);
    return () => {
      window.removeEventListener("beforeunload", protect);
    };
  }, [song, dirty, slug]);
  function change(patch: Partial<SongInput>) {
    setSong((current) => ({ ...current, ...patch }));
    setDirty(true);
  }
  async function save() {
    if (!song.title.trim()) {
      setError("Give your song a title before saving.");
      document.getElementById("song-title")?.focus();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await api<{ song: Song }>(
        slug ? `/api/songs/${encodeURIComponent(slug)}` : "/api/songs",
        { method: slug ? "PATCH" : "POST", body: JSON.stringify(song) },
      );
      setDirty(false);
      try {
        localStorage.removeItem(`worshiply-draft:${slug || "new"}`);
      } catch {}
      router.push(`/songs/${result.song.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the song.");
      setSaving(false);
    }
  }
  if (loading)
    return (
      <main className="state-panel" role="status">
        Opening your song…
      </main>
    );
  if (!allowed)
    return (
      <main className="state-panel">
        <h1>This song is view-only here.</h1>
        <p role="alert">{error}</p>
        <Link className="button primary" href={`/songs/${slug}`}>
          Open song page
        </Link>
      </main>
    );
  return (
    <main className="editor-page">
      <div className="page-heading no-print">
        <div>
          <Link className="back-link" href="/songs">
            <ArrowLeft size={14} /> Song library
          </Link>
          <div className="heading-with-badge">
            <h1>{slug ? "Edit song" : "Create a chord sheet"}</h1>
            <span className="badge">
              {dirty ? "Unsaved changes" : slug ? "Saved song" : "New song"}
            </span>
          </div>
          <p>A little less prep. A little more worship.</p>
        </div>
        <div className="page-actions">
          <button
            className="button print-action"
            onClick={() => window.print()}
          >
            <Printer size={16} /> Print
          </button>
          <ExportMenu song={song} />
          <button
            className="button primary"
            disabled={saving}
            onClick={() => void save()}
          >
            <Save size={17} />
            {saving ? "Saving…" : "Save song"}
          </button>
        </div>
      </div>
      {error && (
        <div className="notice error no-print" role="alert">
          {error}
        </div>
      )}
      {draft && (
        <div className="notice no-print">
          <span>An unfinished draft is available on this device.</span>
          <button
            onClick={() => {
              setSong(draft);
              setDirty(true);
              setDraft(null);
            }}
          >
            Restore draft
          </button>
          <button
            onClick={() => {
              setDraft(null);
              try {
                localStorage.removeItem(`worshiply-draft:${slug || "new"}`);
              } catch {}
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      <SongMetadata song={song} change={change} />
      <div
        className="mobile-tabs no-print"
        role="tablist"
        aria-label="Editor view"
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const next = tab === "editor" ? "preview" : "editor";
          setTab(next);
          event.currentTarget
            .querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)
            ?.focus();
        }}
      >
        <button
          role="tab"
          data-tab="editor"
          aria-controls="source-panel"
          tabIndex={tab === "editor" ? 0 : -1}
          aria-selected={tab === "editor"}
          onClick={() => setTab("editor")}
        >
          <FileText size={16} /> Editor
        </button>
        <button
          role="tab"
          data-tab="preview"
          aria-controls="preview-panel"
          tabIndex={tab === "preview" ? 0 : -1}
          aria-selected={tab === "preview"}
          onClick={() => setTab("preview")}
        >
          <Eye size={16} /> Preview
        </button>
      </div>
      <div className={`editor-workspace showing-${tab}`}>
        <LyricsEditor song={song} change={change} />
        <section
          id="preview-panel"
          className="preview-panel"
          aria-label="Chord sheet preview"
        >
          <div className="panel-heading no-print">
            <span>
              <Eye size={16} /> Live preview
            </span>
            <span className="live-label">
              <Check size={13} /> Up to date
            </span>
          </div>
          <div className="preview-canvas">
            <ChordSheet song={song} />
          </div>
        </section>
      </div>
      <div className="workspace-footer no-print">
        <span>
          <Music2 size={14} /> Less formatting. More making music together.
        </span>
        <span>Your original chords stay intact when you transpose.</span>
      </div>
    </main>
  );
}
