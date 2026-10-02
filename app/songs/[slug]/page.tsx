import { SongPage } from "@/components/SongPage";
import { UUID_PATTERN } from "@/lib/server/validation";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lineup?: string | string[] }>;
}) {
  const { slug } = await params;
  const { lineup } = await searchParams;
  const lineupId =
    typeof lineup === "string" && UUID_PATTERN.test(lineup) ? lineup : undefined;
  return <SongPage slug={slug} lineupId={lineupId} />;
}
