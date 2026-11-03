import type { Metadata } from "next";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { pageAccount } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: {
    default: "Worshiply · A little less prep. A little more worship.",
    template: "%s · Worshiply",
  },
  description:
    "Create, transpose, share, and print beautiful chord sheets for your worship team.",
  icons: { icon: "/favicon.svg" },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const account = await pageAccount();
  return (
    <html lang="en">
      <body>
        {process.env.NODE_ENV === "development" && (
          <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async />
        )}
        <AppHeader
          account={
            account && { username: account.username, role: account.role }
          }
        />
        {children}
      </body>
    </html>
  );
}
