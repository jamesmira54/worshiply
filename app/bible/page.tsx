import type { Metadata } from "next";
import { BiblePage } from "@/components/bible/BiblePage";

export const metadata: Metadata = { title: "Bible" };

export default function Page() {
  return <BiblePage />;
}
