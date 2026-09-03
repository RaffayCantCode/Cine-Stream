"use client";

import { useState, useEffect } from "react";

const logoCache = new Map<string, string | null>();
const artworkCache = new Map<string, { backdropUrl: string | null; posterUrl: string | null }>();

export function useMediaLogo(id: string | number, type: "movie" | "tv" | "anime", title?: string) {
  const isAnime = type === "anime";
  const cacheKey = `${id}-${title || ""}`;

  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    if (logoCache.has(cacheKey)) return logoCache.get(cacheKey) || null;
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(`logo_v7_${cacheKey}`);
        if (saved) {
          logoCache.set(cacheKey, saved);
          return saved;
        }
      } catch {}
    }
    return null;
  });

  const [artwork, setArtwork] = useState<{ backdropUrl: string | null; posterUrl: string | null }>(() => {
    if (artworkCache.has(cacheKey)) return artworkCache.get(cacheKey)!;
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(`artwork_v1_${cacheKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          artworkCache.set(cacheKey, parsed);
          return parsed;
        }
      } catch {}
    }
    return { backdropUrl: null, posterUrl: null };
  });

  const [loading, setLoading] = useState(!logoUrl);

  useEffect(() => {
    if ((!id || id === "undefined" || id === "null") && !title) {
      setLoading(false);
      return;
    }

    if (logoCache.has(cacheKey) && artworkCache.has(cacheKey)) {
      setLogoUrl(logoCache.get(cacheKey) || null);
      setArtwork(artworkCache.get(cacheKey)!);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const url = isAnime
      ? `/api/tmdb/logo?id=${encodeURIComponent(id)}&title=${encodeURIComponent(title || "")}&type=anime`
      : `/api/tmdb/logo?id=${id}&type=${type}${title ? `&title=${encodeURIComponent(title)}` : ""}`;

    fetch(url, { cache: "force-cache" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const resolvedLogo = data?.logoUrl || null;
        logoCache.set(cacheKey, resolvedLogo);
        if (typeof window !== "undefined" && resolvedLogo) {
          try { sessionStorage.setItem(`logo_v7_${cacheKey}`, resolvedLogo); } catch {}
        }
        setLogoUrl(resolvedLogo);

        const art = {
          backdropUrl: data?.backdropUrl || null,
          posterUrl: data?.posterUrl || null,
        };
        artworkCache.set(cacheKey, art);
        if (typeof window !== "undefined" && (art.backdropUrl || art.posterUrl)) {
          try { sessionStorage.setItem(`artwork_v1_${cacheKey}`, JSON.stringify(art)); } catch {}
        }
        setArtwork(art);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        logoCache.set(cacheKey, null);
        setLogoUrl(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, type, title, cacheKey, isAnime]);

  return { logoUrl, backdropUrl: artwork.backdropUrl, posterUrl: artwork.posterUrl, loading };
}
