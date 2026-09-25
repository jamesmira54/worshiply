import type { Metadata } from "next";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = {
  title: {
    default: "Worshiply · A little less prep. A little more worship.",
    template: "%s · Worshiply",
  },
  description:
    "Create, transpose, share, and print beautiful chord sheets for your worship team.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {process.env.NODE_ENV === "development" && (
          <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async />
        )}
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
