"use client";
import { Minus, Plus, RotateCcw, Guitar, Eye } from "lucide-react";
import type { SongInput } from "@/types/song";
import { getSemitoneDelta, transposeChord } from "@/lib/chord-transposer";

const PITCH_OPTIONS = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
];
export const KEY_OPTIONS = [
  ...PITCH_OPTIONS,
  ...PITCH_OPTIONS.map((key) => `${key}m`),
];
export function EditorToolbar({
  song,
  onChange,
}: {
  song: SongInput;
  onChange: (patch: Partial<SongInput>) => void;
}) {
  const delta = getSemitoneDelta(song.originalKey, song.defaultKey);
  const step = (amount: number) =>
    onChange({
      defaultKey: transposeChord(
        song.defaultKey,
        amount,
        song.defaultKey.includes("b"),
      ),
    });
  return (
    <div className="editor-toolbar no-print">
      <div className="transpose-control">
        <span className="toolbar-label">Transpose</span>
        <button
          className="icon-button"
          aria-label="Transpose down one semitone"
          onClick={() => step(-1)}
        >
          <Minus size={17} />
        </button>
        <label className="sr-only" htmlFor="current-key">
          Current key
        </label>
        <select
          id="current-key"
          value={song.defaultKey}
          onChange={(e) => onChange({ defaultKey: e.target.value })}
        >
          {KEY_OPTIONS.filter(
            (key) => key.endsWith("m") === song.originalKey.endsWith("m"),
          ).map((key) => (
            <option key={key}>{key}</option>
          ))}
        </select>
        <button
          className="icon-button"
          aria-label="Transpose up one semitone"
          onClick={() => step(1)}
        >
          <Plus size={17} />
        </button>
        <span className="transpose-delta">
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
        <button
          className="icon-button reset-button"
          title="Reset to original key"
          aria-label="Reset transposition"
          onClick={() => onChange({ defaultKey: song.originalKey })}
        >
          <RotateCcw size={15} />
        </button>
      </div>
      <div className="toolbar-divider" />
      <label className="toolbar-select">
        <Guitar size={17} />
        <span className="sr-only">Chord diagrams</span>
        <select
          aria-label="Chord diagrams"
          value={song.chordDiagramType}
          onChange={(e) =>
            onChange({
              chordDiagramType: e.target.value as SongInput["chordDiagramType"],
            })
          }
        >
          <option value="guitar">Guitar</option>
          <option value="piano">Piano</option>
          <option value="both">Guitar + Piano</option>
          <option value="none">No diagrams</option>
        </select>
      </label>
      <label className="toolbar-select font-select">
        <span>Aa</span>
        <span className="sr-only">Font size</span>
        <select
          aria-label="Font size"
          value={song.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
        >
          {[10, 12, 14, 16, 18, 20, 24, 28, 32].map((size) => (
            <option key={size} value={size}>
              {size} pt
            </option>
          ))}
        </select>
      </label>
      <button
        className={`button quiet chord-toggle ${song.showChords ? "selected" : ""}`}
        aria-pressed={song.showChords}
        onClick={() => onChange({ showChords: !song.showChords })}
      >
        <Eye size={16} /> Chords
      </button>
      <label className="toolbar-select orientation-select">
        <span className="sr-only">Page orientation</span>
        <select
          aria-label="Page orientation"
          value={song.orientation}
          onChange={(e) =>
            onChange({
              orientation: e.target.value as SongInput["orientation"],
            })
          }
        >
          <option value="portrait">A4 · Portrait</option>
          <option value="landscape">A4 · Landscape</option>
        </select>
      </label>
    </div>
  );
}
