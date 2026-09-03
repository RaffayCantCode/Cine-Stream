"use client";

import { useState, useEffect } from "react";

const logoCache = new Map<string, string | null>();

export function useMediaLogo(id: string | number, type: "movie" | "tv" | "anime", title?: string, tmdbId?: string | number | null) {
  const isAnime = type === "anime";
  const cacheKey = `${id}-${tmdbId || ""}-${title || ""}`;

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

  const [loading, setLoading] = useState(!logoUrl);

  useEffect(() => {
    if ((!id || id === "undefined" || id === "null") && !title && !tmdbId) {
      setLoading(false);
      return;
    }

    if (logoCache.has(cacheKey)) {
      setLogoUrl(logoCache.get(cacheKey) || null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const tmdbParam = tmdbId ? `&tmdbId=${encodeURIComponent(tmdbId)}` : "";
    const url = isAnime
      ? `/api/tmdb/logo?id=${encodeURIComponent(id)}&title=${encodeURIComponent(title || "")}&type=anime${tmdbParam}`
      : `/api/tmdb/logo?id=${id}&type=${type}${title ? `&title=${encodeURIComponent(title)}` : ""}${tmdbParam}`;

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

  return { logoUrl, loading };
}
