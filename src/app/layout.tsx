export const runtime = 'edge';
import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const viewport: Viewport = {
  themeColor: "#020817",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://cine-stream.site"),
  title: {
    template: "%s | CineStream",
    default: "CineStream - Movies, TV & Anime",
  },
  description: "Movies. TV. Anime. All in one place. Stream everything you love — premium, curated, and always fresh.",
  icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CineStream",
  },
  openGraph: {
    title: "CineStream - Movies, TV & Anime",
    description: "Stream premium curated Movies, TV Shows, and Anime.",
    url: "https://cine-stream.site",
    siteName: "CineStream",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "CineStream Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CineStream",
    description: "Stream premium curated Movies, TV Shows, and Anime.",
    images: ["/icon.png"],
  },
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
        
        {/* Streaming sources preconnect */}
        <link rel="preconnect" href="https://vidlink.pro" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://vidfast.pro" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://vidlink.pro" />
        <link rel="dns-prefetch" href="https://vidfast.pro" />
        
        {/* Anime image sources */}
        <link rel="preconnect" href="https://api.anipub.xyz" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.anipub.xyz" />
        <link rel="dns-prefetch" href="https://api.tatakai.me" />
        {/* PWA service worker registration */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .catch(function(err) { console.warn('SW registration failed:', err); });
                
              let refreshing = false;
              navigator.serviceWorker.addEventListener('controllerchange', function() {
                if (!refreshing) {
                  refreshing = true;
                  window.location.reload();
                }
              });
            });
          }
        `}} />
      </head>
      <body className={`${outfit.variable} font-sans antialiased bg-background text-foreground`}>
        {/* Global Background Glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-[-1]">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/5 blur-[120px]" />
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
