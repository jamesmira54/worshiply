import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SignInForm } from "@/components/SignInForm";
import { pageAccount } from "@/lib/server/auth";
import { safeNext } from "@/lib/server/passwords";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeNext((await searchParams).next);
  if (await pageAccount()) redirect(next);
  return <SignInForm next={next} />;
}
