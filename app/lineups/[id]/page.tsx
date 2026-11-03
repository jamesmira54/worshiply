import { redirect } from "next/navigation";
import { LineupPage } from "@/components/lineups/LineupPage";
import { pageAccount } from "@/lib/server/auth";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await pageAccount()))
    redirect(
      `/sign-in?next=${encodeURIComponent(`/lineups/${encodeURIComponent(id)}`)}`,
    );
  return <LineupPage id={id} />;
}
