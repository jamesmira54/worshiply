import { SongEditor } from "@/components/editor/SongEditor";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <SongEditor slug={slug} />;
}
