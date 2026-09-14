import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";

const title = "Tourist — Repository City";
const description =
  "A persistent cloud coding agent, drawn as an island. Connect a GitHub repo, watch files become buildings, and keep working after you close the laptop.";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Tourist — a living island city for your GitHub repository" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [{ url: "/twitter-image.png", width: 1200, height: 630, alt: "Tourist — a living island city for your GitHub repository" }],
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
