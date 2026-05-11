import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const manrope = Manrope({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SV - Stream Vault",
  description: "Premium-style streaming experience for movies, TV, anime, and manga.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${manrope.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
