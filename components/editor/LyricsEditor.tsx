"use client";
import { CircleHelp, FileText, Music2, RotateCcw } from "lucide-react";
import type { SongInput } from "@/types/song";
import { blankSong, exampleSong } from "@/lib/song-defaults";
export function LyricsEditor({
  song,
  change,
}: {
  song: SongInput;
  change: (patch: Partial<SongInput>) => void;
}) {
  return (
    <section
      id="source-panel"
      className="source-panel no-print"
      aria-label="Lyrics editor"
    >
      <div className="panel-heading">
        <span>
          <FileText size={16} /> Lyrics & chords
        </span>
        <details className="syntax-help">
          <summary aria-label="Chord syntax help">
            <CircleHelp size={17} />
          </summary>
          <div className="help-popover">
            <strong>A chord before a word.</strong>
            <p>
              Type <code>[C]Amazing [G]grace</code>. We place each chord above
              its lyric.
            </p>
            <p>
              Use <code>[Verse 1]</code> or <code>[Chorus]</code> for sections.
              Blank lines stay blank.
            </p>
            <p>Examples: Am7, F#sus4, Bbmaj7, C/E.</p>
          </div>
        </details>
      </div>
      <div className="source-intro">
        <span className="mini-badge">[C]</span>
        <span>Place chords in brackets, right before the lyrics.</span>
      </div>
      <label className="sr-only" htmlFor="lyrics-source">
        Lyrics with inline chords
      </label>
      <textarea
        id="lyrics-source"
        className="lyrics-input"
        value={song.lyrics}
        onChange={(e) => change({ lyrics: e.target.value })}
        spellCheck={false}
        maxLength={60000}
        placeholder={
          "[Verse 1]\n[C]Your first line of lyrics\n[F]A new chord, a [G]new phrase\n\n[Chorus]\n[Am]Let your song begin…"
        }
      />
      <div className="source-footer">
        <span>
          {song.lyrics.split("\n").filter(Boolean).length} lines ·{" "}
          {song.lyrics.length.toLocaleString()} characters
        </span>
        {!song.lyrics && (
          <button onClick={() => change(exampleSong)}>
            <Music2 size={14} /> Try an example
          </button>
        )}
        {song.lyrics === exampleSong.lyrics && (
          <button onClick={() => change(blankSong)}>
            <RotateCcw size={14} /> Start fresh
          </button>
        )}
      </div>
    </section>
  );
}
