import { SONG_CATEGORIES, DEFAULT_CATEGORY } from "@/types/song";
import type { SongInput } from "@/types/song";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const KEYS = new Set([
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
  "Cm",
  "C#m",
  "Dbm",
  "Dm",
  "D#m",
  "Ebm",
  "Em",
  "Fm",
  "F#m",
  "Gbm",
  "Gm",
  "G#m",
  "Abm",
  "Am",
  "A#m",
  "Bbm",
  "Bm",
]);

export function validateSong(value: unknown): SongInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "Please provide a song object.");
  const input = value as Record<string, unknown>;
  function string(name: string, limit: number, fallback = "") {
    const result = input[name] ?? fallback;
    if (typeof result !== "string" || result.length > limit)
      throw new ApiError(
        400,
        `${name} must be text with at most ${limit.toLocaleString()} characters.`,
      );
    return result;
  }
  const category = input.category === undefined ? DEFAULT_CATEGORY : input.category;
  if (!SONG_CATEGORIES.includes(category as SongInput["category"]))
    throw new ApiError(400, "Choose a valid song category.");
  const title = string("title", 160).trim();
  if (!title) throw new ApiError(400, "Give your song a title.");
  const originalKey = string("originalKey", 4, "C");
  const defaultKey = string("defaultKey", 4, originalKey);
  if (!KEYS.has(originalKey) || !KEYS.has(defaultKey))
    throw new ApiError(400, "Choose a valid musical key.");
  const bpm = string("bpm", 3);
  if (bpm && (!/^\d+$/.test(bpm) || Number(bpm) < 20 || Number(bpm) > 400))
    throw new ApiError(400, "Tempo must be between 20 and 400 BPM.");
  const capo = string("capo", 2, "0");
  if (capo && (!/^\d+$/.test(capo) || Number(capo) > 12))
    throw new ApiError(400, "Capo must be between 0 and 12.");
  const timeSignature = string("timeSignature", 8, "4/4");
  if (
    timeSignature &&
    !/^(?:[1-9]|1[0-6])\/(?:1|2|4|8|16)$/.test(timeSignature)
  )
    throw new ApiError(400, "Choose a valid time signature.");
  const chordDiagramType = input.chordDiagramType ?? "both";
  if (!["guitar", "piano", "both", "none"].includes(chordDiagramType as string))
    throw new ApiError(400, "Choose a valid chord diagram type.");
  const orientation = input.orientation ?? "portrait";
  if (orientation !== "portrait" && orientation !== "landscape")
    throw new ApiError(400, "Choose a valid page orientation.");
  const fontSize = input.fontSize ?? 16;
  if (
    typeof fontSize !== "number" ||
    !Number.isInteger(fontSize) ||
    fontSize < 10 ||
    fontSize > 32
  )
    throw new ApiError(400, "Font size must be between 10 and 32.");
  const showChords = input.showChords ?? true;
  if (typeof showChords !== "boolean")
    throw new ApiError(400, "Show chords must be true or false.");
  return {
    category: category as SongInput["category"],
    title,
    artist: string("artist", 160).trim(),
    lyrics: string("lyrics", 60000),
    originalKey,
    defaultKey,
    bpm,
    timeSignature,
    capo,
    notes: string("notes", 6000),
    chordDiagramType: chordDiagramType as SongInput["chordDiagramType"],
    fontSize,
    showChords,
    orientation,
  };
}
