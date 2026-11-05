import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AccessNotice } from "@/components/AccessNotice";
import { UserManager } from "@/components/UserManager";
import { pageAccount } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const account = await pageAccount();
  if (!account) redirect("/sign-in?next=%2Fusers");
  if (account.role !== "admin")
    return (
      <AccessNotice
        message="Only the admin can manage users."
        href="/songs"
        label="Back to songs"
      />
    );
  return <UserManager />;
}
