"use client";
import { SlidersHorizontal } from "lucide-react";
import { SONG_CATEGORIES, DEFAULT_CATEGORY } from "@/types/song";
import { DismissibleDetails } from "../DismissibleDetails";
import type { SongInput } from "@/types/song";
import { EditorToolbar, KEY_OPTIONS } from "./EditorToolbar";
export function SongMetadata({
  song,
  change,
}: {
  song: SongInput;
  change: (patch: Partial<SongInput>) => void;
}) {
  return (
    <section className="metadata-panel no-print" aria-label="Song information">
      <div className="metadata-main">
        <label className="title-field">
          Song title
          <input
            id="song-title"
            value={song.title}
            onChange={(e) => change({ title: e.target.value })}
            placeholder="Give your song a name"
            maxLength={160}
          />
        </label>
        <label className="artist-field">
          Artist / worship team
          <input
            value={song.artist}
            onChange={(e) => change({ artist: e.target.value })}
            placeholder="Artist or team name"
            maxLength={160}
          />
        </label>
        <label className="key-field">
          Original key
          <select
            value={song.originalKey}
            onChange={(e) =>
              change({
                originalKey: e.target.value,
                defaultKey: e.target.value,
              })
            }
          >
            {KEY_OPTIONS.map((key) => (
              <option key={key}>{key}</option>
            ))}
          </select>
        </label>
        <DismissibleDetails className="more-details">
          <summary className="button quiet">
            <SlidersHorizontal size={16} /> Song details
          </summary>
          <div className="metadata-extra">
            <label>
              Tempo (BPM)
              <input
                inputMode="numeric"
                value={song.bpm}
                onChange={(e) => change({ bpm: e.target.value })}
                placeholder="72"
                maxLength={3}
              />
            </label>
            <label>
              Time signature
              <input
                value={song.timeSignature}
                onChange={(e) => change({ timeSignature: e.target.value })}
                placeholder="4/4"
                maxLength={8}
              />
            </label>
            <label>
              Capo
              <input
                inputMode="numeric"
                value={song.capo}
                onChange={(e) => change({ capo: e.target.value })}
                placeholder="0"
                maxLength={2}
              />
            </label>
            <label className="category-field">
              Category
              <select value={song.category ?? DEFAULT_CATEGORY} onChange={(e) => change({ category: e.target.value as SongInput["category"] })}>
                {SONG_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label className="notes-field">
              Notes
              <textarea
                rows={2}
                value={song.notes}
                onChange={(e) => change({ notes: e.target.value })}
                placeholder="Arrangement or rehearsal notes"
                maxLength={6000}
              />
            </label>
          </div>
        </DismissibleDetails>
      </div>
      <EditorToolbar song={song} onChange={change} />
    </section>
  );
}
