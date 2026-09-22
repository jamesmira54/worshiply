import type { CSSProperties } from "react";
import type { SongInput } from "@/types/song";
import { parseLyrics } from "@/lib/chord-parser";
import { transposeLyrics } from "@/lib/chord-transposer";
import {
  GuitarChordDiagram,
  PianoChordDiagram,
} from "@/components/chords/ChordDiagram";

export function ChordSheet({ song }: { song: SongInput }) {
  const lines = parseLyrics(
    transposeLyrics(song.lyrics, song.originalKey, song.defaultKey),
  );
  const chords = [
    ...new Set(
      lines.flatMap((line) =>
        line.type === "lyric"
          ? line.segments.flatMap((segment) =>
              segment.chord ? [segment.chord] : [],
            )
          : [],
      ),
    ),
  ];
  const diagrams = song.chordDiagramType !== "none" && chords.length > 0;
  const groups: (typeof lines)[] = [];
  for (const line of lines) {
    if (line.type === "section" || groups.length === 0) groups.push([]);
    groups[groups.length - 1].push(line);
  }
  return (
    <article
      className={`chord-sheet ${song.orientation} ${diagrams ? "with-diagrams" : ""}`}
      style={{ "--sheet-font": `${song.fontSize}pt` } as CSSProperties}
      aria-label="Formatted chord sheet"
    >
      <style>{`@media print { @page { size: A4 ${song.orientation}; margin: 14mm; } }`}</style>
      <header className="sheet-header">
        <span className="sheet-eyebrow">WORSHIPLY / CHORD SHEET</span>
        <h1>{song.title || "Untitled song"}</h1>
        {song.artist && <p className="sheet-artist">{song.artist}</p>}
        <div className="sheet-metadata">
          {song.defaultKey && (
            <span>
              Key <b>{song.defaultKey}</b>
            </span>
          )}
          {song.bpm && (
            <span>
              Tempo <b>{song.bpm} BPM</b>
            </span>
          )}
          {song.timeSignature && (
            <span>
              Time <b>{song.timeSignature}</b>
            </span>
          )}
          {song.capo && (
            <span>
              Capo <b>{song.capo === "0" ? "None" : song.capo}</b>
            </span>
          )}
        </div>
      </header>
      <div className="sheet-body">
        {diagrams && (
          <aside className="chord-sidebar" aria-label="Chord diagrams">
            {["guitar", "piano"]
              .filter(
                (type) =>
                  song.chordDiagramType === type ||
                  song.chordDiagramType === "both",
              )
              .map((type) => (
                <section key={type}>
                  <h2>
                    {type === "guitar" ? "Guitar chords" : "Piano chords"}
                  </h2>
                  <div className={`diagram-grid ${type}`}>
                    {chords.map((chord) => (
                      <div key={chord} className="chord-diagram">
                        <strong>{chord}</strong>
                        {type === "guitar" ? (
                          <GuitarChordDiagram chord={chord} />
                        ) : (
                          <PianoChordDiagram chord={chord} />
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
          </aside>
        )}
        <div className="sheet-lyrics">
          {!song.lyrics && (
            <p className="sheet-empty">
              Your music starts here.
              <br />
              <span>Add lyrics and chords to see your sheet come to life.</span>
            </p>
          )}
          {groups.map((group, i) => (
            <section className="song-section" key={i}>
              {group.map((line, j) =>
                line.type === "section" ? (
                  <h2 className="section-label" key={j}>
                    {line.label}
                  </h2>
                ) : line.type === "blank" ? (
                  <div className="blank-line" key={j} />
                ) : (
                  <div
                    className={`chord-line ${song.showChords && line.segments.some((s) => s.chord) ? "has-chords" : ""}`}
                    key={j}
                  >
                    {line.segments.map((segment, k) => (
                      <span className="chord-segment" key={k}>
                        {song.showChords && (
                          <span className="chord-symbol">
                            {segment.chord || "\u00a0"}
                          </span>
                        )}
                        <span className="lyric-text">
                          {segment.lyric || "\u00a0"}
                        </span>
                      </span>
                    ))}
                  </div>
                ),
              )}
            </section>
          ))}
          {song.notes && <p className="sheet-notes">{song.notes}</p>}
        </div>
      </div>
      <footer className="sheet-footer">
        <span>worshiply.</span>
        <span>Prepared for the moments that matter.</span>
      </footer>
    </article>
  );
}
