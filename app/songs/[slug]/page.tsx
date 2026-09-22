import { SongPage } from "@/components/SongPage";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <SongPage slug={slug} />;
}
