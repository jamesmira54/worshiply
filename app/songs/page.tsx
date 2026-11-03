import { SongLibrary } from "@/components/SongLibrary";
import { pageAccount } from "@/lib/server/auth";

export default async function SongsPage() {
  const account = await pageAccount();
  return <SongLibrary canEdit={account?.role === "admin"} />;
}
