import { redirect } from "next/navigation";
import { SongEditor } from "@/components/editor/SongEditor";
import { AccessNotice } from "@/components/AccessNotice";
import { pageAccount } from "@/lib/server/auth";

export default async function NewSongPage() {
  const account = await pageAccount();
  if (!account) redirect("/sign-in?next=%2Fsongs%2Fnew");
  if (account.role !== "admin")
    return (
      <AccessNotice
        message="Only the admin can edit songs."
        href="/songs"
        label="Back to songs"
      />
    );
  return <SongEditor />;
}
