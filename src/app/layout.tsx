import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { AmbientGlow } from "@/components/layout/AmbientGlow";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tender Price | Rule Based Calculator",
  description: "Rule-based tender price calculator for structured project cost estimation.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    other: [
      { rel: "icon", url: "/android-chrome-192x192.png", type: "image/png", sizes: "192x192" },
      { rel: "icon", url: "/android-chrome-512x512.png", type: "image/png", sizes: "512x512" },
    ],
  },
};

const fontVariables = {
  "--font-plus-jakarta-sans":
    '"Plus Jakarta Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
} as CSSProperties;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={fontVariables} className="antialiased">
        <AmbientGlow />
        <div className="mesh-gradient pointer-events-none fixed inset-0 -z-20" />
        <div className="cursor-glow pointer-events-none fixed inset-0 -z-10" />
        {children}
      </body>
    </html>
  );
}
