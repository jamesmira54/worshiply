import { SongPage } from "@/components/SongPage";
import { UUID_PATTERN } from "@/lib/server/validation";
import { SLOT_KEYS, type SlotKey } from "@/types/lineup";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const one = (value?: string | string[]) => (typeof value === "string" ? value : undefined);

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<"lineup" | "sunday" | "slot", string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const lineup = one(query.lineup);
  const sunday = one(query.sunday);
  const slot = one(query.slot);
  const lineupId = lineup && UUID_PATTERN.test(lineup) ? lineup : undefined;
  // Sunday and slot only matter with a lineup; anything malformed is dropped.
  const place =
    lineupId && sunday && DATE_PATTERN.test(sunday) && SLOT_KEYS.includes(slot as SlotKey)
      ? { id: lineupId, sunday, slot: slot as SlotKey }
      : undefined;
  return <SongPage slug={slug} lineupId={lineupId} place={place} />;
}
