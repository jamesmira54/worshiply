import { redirect } from "next/navigation";
import { LineupList } from "@/components/lineups/LineupList";
import { pageAccount } from "@/lib/server/auth";

export default async function LineupsPage() {
  const account = await pageAccount();
  if (!account) redirect("/sign-in?next=%2Flineups");
  return <LineupList canEdit={account.role === "admin"} />;
}
