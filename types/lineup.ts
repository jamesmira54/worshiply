import type { SongCategory } from "./song";

export const SLOT_KEYS = ["singspiration", "worship1", "worship2", "closing"] as const;
export type SlotKey = (typeof SLOT_KEYS)[number];

export interface LineupSong {
  id: string;
  slug: string;
  title: string;
  artist: string;
  category: SongCategory;
  defaultKey: string;
}
export type SlotValue = LineupSong | { removed: true } | null;

export interface Lineup {
  id: string;
  month: string;
  updatedAt: string;
  sundays: { date: string; slots: Record<SlotKey, SlotValue> }[];
}
export interface LineupSummary {
  id: string;
  month: string;
  updatedAt: string;
}
export interface SlotAssignment {
  sunday: string;
  slot: SlotKey;
  songId: string | null;
}
