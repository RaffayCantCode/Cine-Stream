import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "CineStream",
  description: "Movies. TV. Anime. All in one place. Stream everything you love — premium, curated, and always fresh.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* ─── Performance: open connections to image CDN before images are needed ─── */}
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
        {/* Anime image sources */}
        <link rel="preconnect" href="https://api.anipub.xyz" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.anipub.xyz" />
        <link rel="dns-prefetch" href="https://api.tatakai.me" />
      </head>
      <body className={`${outfit.variable} font-sans antialiased bg-background text-foreground`}>
        {/* Global Background Glow */}
        <div className="fixed inset-0 z-[-1] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1f285c]/30 via-background to-background pointer-events-none" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
