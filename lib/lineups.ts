import type { SongCategory } from "@/types/song";
import type { Lineup, SlotKey } from "@/types/lineup";

export const SLOTS: { key: SlotKey; label: string; category: SongCategory | null }[] = [
  { key: "singspiration", label: "Singspiration", category: "Singspiration" },
  { key: "worship1", label: "Worship song 1", category: "Praise & Worship" },
  { key: "worship2", label: "Worship song 2", category: "Praise & Worship" },
  { key: "closing", label: "Closing song", category: null },
];

export type LineupPlace = { id: string; sunday: string; slot: SlotKey };

/** A song link that remembers which lineup Sunday and slot it was opened from. */
export function lineupSongHref(slug: string, place: LineupPlace) {
  const query = new URLSearchParams({ lineup: place.id, sunday: place.sunday, slot: place.slot });
  return `/songs/${encodeURIComponent(slug)}?${query}`;
}

/** A Sunday's assigned songs in slot order, skipping empty and removed slots. */
export function sundayQueue(lineup: Lineup, sunday: string) {
  const day = lineup.sundays.find((item) => item.date === sunday);
  if (!day) return [];
  return SLOTS.flatMap(({ key, label }) => {
    const value = day.slots[key];
    return value && !("removed" in value)
      ? [{ slot: key, label, slug: value.slug, title: value.title }]
      : [];
  });
}

export const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** ISO dates of every Sunday in a "YYYY-MM" month, computed in UTC. */
export function sundaysInMonth(month: string): string[] {
  const match = MONTH_PATTERN.exec(month);
  if (!match) throw new Error(`Invalid month: ${month}`);
  const year = Number(match[1]);
  const index = Number(match[2]) - 1;
  const first = new Date(Date.UTC(year, index, 1));
  const day = new Date(Date.UTC(year, index, 1 + ((7 - first.getUTCDay()) % 7)));
  const dates: string[] = [];
  while (day.getUTCMonth() === index) {
    dates.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 7);
  }
  return dates;
}

export function formatSunday(date: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatMonth(month: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}
