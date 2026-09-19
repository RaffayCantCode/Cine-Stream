"use client";

import { useState, useEffect } from "react";

const logoCache = new Map<string, string | null>();
const artworkCache = new Map<string, { backdropUrl: string | null; posterUrl: string | null }>();

export function useMediaLogo(
  id: string | number,
  type: "movie" | "tv" | "anime",
  title?: string,
  initialLogo?: string | null
) {
  const isAnime = type === "anime";
  const safeTitle = typeof title === "string" ? title : (title && typeof title === "object" ? ((title as any).english || (title as any).romaji || (title as any).native || "") : "");
  const cacheKey = `${id}-${safeTitle}`;

  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogo || null);
  const [artwork, setArtwork] = useState<{ backdropUrl: string | null; posterUrl: string | null }>({
    backdropUrl: null,
    posterUrl: null,
  });
  const [loading, setLoading] = useState(!initialLogo);

  useEffect(() => {
    if (initialLogo) {
      setLogoUrl(initialLogo);
      logoCache.set(cacheKey, initialLogo);
      setLoading(false);
      return;
    }
    if ((!id || id === "undefined" || id === "null") && !safeTitle) {
      setLoading(false);
      return;
    }

    if (logoCache.has(cacheKey) && artworkCache.has(cacheKey)) {
      setLogoUrl(logoCache.get(cacheKey) || null);
      setArtwork(artworkCache.get(cacheKey)!);
      setLoading(false);
      return;
    }

    if (typeof window !== "undefined") {
      try {
        const savedLogo = sessionStorage.getItem(`logo_v7_${cacheKey}`);
        const savedArt = sessionStorage.getItem(`artwork_v1_${cacheKey}`);
        if (savedLogo || savedArt) {
          if (savedLogo) {
            logoCache.set(cacheKey, savedLogo);
            setLogoUrl(savedLogo);
          }
          if (savedArt) {
            const parsed = JSON.parse(savedArt);
            if (parsed && typeof parsed === "object") {
              artworkCache.set(cacheKey, parsed);
              setArtwork(parsed);
            }
          }
          setLoading(false);
          return;
        }
      } catch {}
    }

    let cancelled = false;
    const url = isAnime
      ? `/api/tmdb/logo?id=${encodeURIComponent(id)}&title=${encodeURIComponent(safeTitle)}&type=anime`
      : `/api/tmdb/logo?id=${id}&type=${type}${safeTitle ? `&title=${encodeURIComponent(safeTitle)}` : ""}`;

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
  }, [id, type, safeTitle, cacheKey, isAnime, initialLogo]);

  return { logoUrl, backdropUrl: artwork?.backdropUrl || null, posterUrl: artwork?.posterUrl || null, loading };
}
