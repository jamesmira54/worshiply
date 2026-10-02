"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, PenLine, Copy, Printer } from "lucide-react";
import type { Song } from "@/types/song";
import { api } from "@/lib/api";
import { ChordSheet } from "./chord-sheet/ChordSheet";
import { EditorToolbar } from "./editor/EditorToolbar";
import { ExportMenu } from "./export/ExportMenu";
import { ShareMenu } from "./ShareMenu";

export function SongPage({
  slug,
  lineupId,
}: {
  slug: string;
  lineupId?: string;
}) {
  const router = useRouter();
  const [song, setSong] = useState<Song | null>(null);
  const [canonical, setCanonical] = useState<Song | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api<{ song: Song; canEdit: boolean }>(
      `/api/songs/${encodeURIComponent(slug)}`,
      { signal: controller.signal },
    )
      .then((data) => {
        setSong(data.song);
        setCanonical(data.song);
        setCanEdit(data.canEdit);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [slug]);
  async function duplicate() {
    if (!canonical) return;
    setBusy(true);
    try {
      const result = await api<{ song: Song }>("/api/songs", {
        method: "POST",
        body: JSON.stringify({
          ...canonical,
          title: `${canonical.title} (copy)`.slice(0, 160),
        }),
      });
      router.push(`/songs/${result.song.slug}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not duplicate song.");
      setBusy(false);
    }
  }
  if (!song)
    return (
      <main className="state-panel">
        <h1>
          {error ? "Could not open this song" : "Opening your chord sheet…"}
        </h1>
        {error && (
          <>
            <p role="alert">{error}</p>
            <Link href="/songs" className="button">
              Back to songs
            </Link>
          </>
        )}
      </main>
    );
  return (
    <main className="song-view-page">
      <div className="page-heading no-print">
        <div>
          <Link href={lineupId ? `/lineups/${lineupId}` : "/songs"} className="back-link">
            <ArrowLeft size={14} /> {lineupId ? "Monthly lineup" : "Song library"}
          </Link>
          <h1>{song.title}</h1>
          <p>Ready for rehearsal. Ready to share.</p>
        </div>
        <div className="page-actions">
          <ShareMenu slug={song.slug} title={song.title} />
          <button className="button" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
          <ExportMenu song={song} />
          {canEdit ? (
            <Link className="button primary" href={`/songs/${song.slug}/edit`}>
              <PenLine size={16} /> Edit song
            </Link>
          ) : (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void duplicate()}
            >
              <Copy size={16} />
              {busy ? "Copying…" : "Make a copy"}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="notice error no-print" role="alert">
          {error}
        </div>
      )}
      <div className="view-toolbar">
        <EditorToolbar
          song={song}
          onChange={(patch) => setSong({ ...song, ...patch })}
        />
        <div className="view-info no-print">
          <span>
            Original key <b>{song.originalKey}</b> <span>·</span> Saved key{" "}
            <b>{canonical?.defaultKey}</b>
          </span>
          <span>
            Changes here are just for you. Your saved song stays the same.
          </span>
        </div>
      </div>
      <div className="song-view-canvas">
        <ChordSheet song={song} />
      </div>
    </main>
  );
}
