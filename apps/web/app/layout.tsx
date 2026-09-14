import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";

const title = "Tourist — Repository City";
const description =
  "A persistent cloud coding agent, drawn as an island. Connect a GitHub repo, watch files become buildings, and keep working after you close the laptop.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: title,
    template: "%s · Tourist",
  },
  description,
  applicationName: "Tourist",
  keywords: [
    "Tourist",
    "coding agent",
    "GitHub",
    "repository city",
    "cloud agents",
    "isometric",
  ],
  authors: [{ name: "Tourist" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Tourist",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
