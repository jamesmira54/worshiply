import type { SongCategory } from "@/types/song";
import type { SlotKey } from "@/types/lineup";

export const SLOTS: { key: SlotKey; label: string; category: SongCategory | null }[] = [
  { key: "singspiration", label: "Singspiration", category: "Singspiration" },
  { key: "worship1", label: "Worship song 1", category: "Praise & Worship" },
  { key: "worship2", label: "Worship song 2", category: "Praise & Worship" },
  { key: "closing", label: "Closing song", category: null },
];

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
