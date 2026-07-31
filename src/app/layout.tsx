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
    template: "%s",
    default: "CineStream",
  },
  icons: {
    icon: [
      { url: "/favicon.svg?v=22", type: "image/svg+xml" },
      { url: "/icon-192.png?v=22", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png?v=22", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=22", sizes: "180x180", type: "image/png" },
      { url: "/apple-icon.png?v=22", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CineStream",
  },
  openGraph: {
    title: "CineStream - Movies, TV & Anime",
    description: "Stream premium curated Movies, TV Shows, and Anime.",
    url: "https://cine-stream.site",
    siteName: "CineStream",
    images: [
      {
        url: "/icon.png?v=22",
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
    title: "CineStream - Movies, TV & Anime",
    description: "Stream premium curated Movies, TV Shows, and Anime.",
    images: ["/icon.png?v=22"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Preconnect to TMDB */}
        <link rel="preconnect" href="https://api.themoviedb.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.themoviedb.org" />
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
        
        {/* Anime image sources */}
        <link rel="preconnect" href="https://api.anipub.xyz" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.anipub.xyz" />
        <link rel="dns-prefetch" href="https://api.tatakai.me" />
        {/* Deployment Cache Invalidation */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var BUILD_VER = 'v22-logo-icon-cache-reset';
            try {
              if (typeof sessionStorage !== 'undefined') {
                var ver = sessionStorage.getItem('sv_build_ver');
                if (ver !== BUILD_VER) {
                  sessionStorage.clear();
                  sessionStorage.setItem('sv_build_ver', BUILD_VER);
                  if (typeof caches !== 'undefined') {
                    caches.keys().then(function(keys) {
                      keys.forEach(function(k) { caches.delete(k); });
                    });
                  }
                }
              }
            } catch(e) {}
          })();
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .catch(function(err) { console.warn('SW registration failed:', err); });
            });
          }
        `}} />

        {/* Explicit Apple Touch Icons for iPhone Home Screen Bookmark & PWA */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=22" />
        <link rel="shortcut icon" href="/favicon.svg?v=22" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=22" />
        <link rel="apple-touch-icon-precomposed" sizes="180x180" href="/apple-touch-icon-precomposed.png?v=22" />
        <link rel="apple-touch-icon" href="/apple-icon.png?v=22" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CineStream" />
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
