import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
