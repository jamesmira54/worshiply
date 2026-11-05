import { redirect } from "next/navigation";
import { SongEditor } from "@/components/editor/SongEditor";
import { AccessNotice } from "@/components/AccessNotice";
import { pageAccount } from "@/lib/server/auth";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const songPath = `/songs/${encodeURIComponent(slug)}`;
  const account = await pageAccount();
  if (!account)
    redirect(`/sign-in?next=${encodeURIComponent(`${songPath}/edit`)}`);
  if (account.role !== "admin")
    return (
      <AccessNotice
        message="Only the admin can edit songs."
        href={songPath}
        label="Open song page"
      />
    );
  return <SongEditor slug={slug} />;
}
