import { NextRequest } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Same-origin image proxy.
 *
 * Palette extraction samples cover art on a canvas. Cross-origin CDNs without
 * permissive CORS headers taint that canvas, which silently left every anime
 * page on the default theme. Serving the (trusted) poster through our own
 * origin makes sampling always work, and lets us ask the CDNs for a small
 * variant so the extra request stays cheap.
 */

const ALLOWED_HOSTS = [
  "anilist.co",
  "image.tmdb.org",
  "kitsu.app",
  "kitsu.io",
  "myanimelist.net",
  "gogoanime.org",
];

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

/** Request the smallest variant the CDN supports; sampling only needs ~60×90. */
function smallVariant(url: URL): URL {
  const next = new URL(url.href);
  const host = next.hostname;
  if (host.endsWith("anilist.co")) {
    next.pathname = next.pathname
      .replace("/cover/extraLarge/", "/cover/medium/")
      .replace("/cover/large/", "/cover/medium/")
      .replace("/cover/medium/", "/cover/medium/");
  } else if (host === "image.tmdb.org") {
    next.pathname = next.pathname.replace(/^\/t\/p\/[^/]+\//, "/t/p/w185/");
  }
  return next;
}

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
  "CDN-Cache-Control": "public, max-age=31536000, immutable",
  "Cloudflare-CDN-Cache-Control": "public, max-age=31536000, immutable",
  "Access-Control-Allow-Origin": "*",
  "X-Content-Type-Options": "nosniff",
} as const;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new Response("Missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const upstream = await fetch(smallVariant(parsed).href, {
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*" },
      redirect: "follow",
    });

    if (!upstream.ok || !upstream.body) {
      return new Response("Upstream error", { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return new Response("Not an image", { status: 415, headers: { "Cache-Control": "no-store" } });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: { ...CACHE_HEADERS, "Content-Type": contentType },
    });
  } catch {
    return new Response("Fetch failed", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
