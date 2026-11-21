"use client";

import { useEffect, useState, memo } from "react";
import Link from "next/link";

interface CompanyLinkItem {
  id?: number | string;
  name: string;
  logo_path?: string | null;
}

export interface MediaSpecsCardProps {
  mediaType: "movie" | "tv";
  status?: string | null;
  releaseDate?: string | null;
  lastAirDate?: string | null;
  runtimeMinutes?: number | null;
  language?: string | null;
  budget?: number | null;
  revenue?: number | null;
  seasonsCount?: number | null;
  episodesCount?: number | null;
  studios?: CompanyLinkItem[];
  networks?: CompanyLinkItem[];
}

function formatFullCurrency(val?: number | null): string | null {
  const num = Number(val || 0);
  if (!Number.isFinite(num) || num <= 0) return null;
  return `$${Math.round(num).toLocaleString("en-US")}`;
}

function formatLanguage(code?: string | null): string | null {
  if (!code) return null;
  const map: Record<string, string> = {
    en: "English",
    ja: "Japanese",
    ko: "Korean",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    zh: "Chinese",
    ru: "Russian",
    tr: "Turkish",
    th: "Thai",
    hi: "Hindi",
    ar: "Arabic",
    nl: "Dutch",
    sv: "Swedish",
    da: "Danish",
    no: "Norwegian",
    pl: "Polish",
  };
  return map[code.toLowerCase()] || code.toUpperCase();
}

/**
 * Checks whether a TMDB studio/network logo has a transparent background.
 * Some TMDB logos are solid-background PNGs or JPEGs — applying `brightness-0 invert`
 * to a solid-background image turns the entire rectangle into a solid white block!
 * We sample corner/edge alpha and total opaque ratio on an offscreen canvas;
 * if it's a solid box, we render a clean typographic wordmark instead.
 */
const StudioLogoMark = memo(function StudioLogoMark({
  name,
  logoPath,
  href,
}: {
  name: string;
  logoPath?: string | null;
  href: string;
}) {
  const isNonTransparentExt =
    !logoPath || /\.(jpe?g|bmp)$/i.test(logoPath);
  const [useTextFallback, setUseTextFallback] = useState(isNonTransparentExt);
  const [verified, setVerified] = useState(false);

  const src =
    logoPath && !isNonTransparentExt
      ? `https://image.tmdb.org/t/p/w300${logoPath}`
      : null;

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    try {
      const w = 24;
      const h = 24;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setVerified(true);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;

      // Check 4 corners
      const cornerIndices = [
        0,
        (w - 1) * 4,
        (h - 1) * w * 4,
        ((h - 1) * w + (w - 1)) * 4,
      ];
      let opaqueCorners = 0;
      for (const idx of cornerIndices) {
        if (data[idx + 3] > 160) opaqueCorners++;
      }

      // Count total opaque pixels across the 24x24 grid
      let opaqueCount = 0;
      const totalPixels = w * h;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 180) opaqueCount++;
      }
      const opaqueRatio = opaqueCount / totalPixels;

      // If 3+ corners are opaque OR >72% of the bounding box is solid,
      // brightness-0 invert will look like a solid white rectangle/line.
      if (opaqueCorners >= 3 || opaqueRatio > 0.72 || opaqueCount < 8) {
        setUseTextFallback(true);
      } else {
        setVerified(true);
      }
    } catch {
      // If CORS prevents reading canvas data, show the image normally
      setVerified(true);
    }
  };

  return (
    <Link
      href={href}
      title={`Browse all titles from ${name}`}
      className="group inline-flex items-center justify-center opacity-75 hover:opacity-100 transition-all duration-200 hover:scale-105"
    >
      {src && !useTextFallback ? (
        <img
          src={src}
          alt={name}
          crossOrigin="anonymous"
          onLoad={handleLoad}
          onError={() => setUseTextFallback(true)}
          className={`max-h-7 sm:max-h-9 max-w-[110px] sm:max-w-[125px] w-auto object-contain brightness-0 invert transition-opacity duration-200 ${
            verified ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] sm:text-xs font-black uppercase tracking-[0.16em] text-white/80 group-hover:text-white group-hover:border-white/25 transition-all">
          {name}
        </span>
      )}
    </Link>
  );
});

export const MediaSpecsCard = memo(function MediaSpecsCard({
  mediaType,
  status,
  releaseDate,
  lastAirDate,
  runtimeMinutes,
  language,
  budget,
  revenue,
  seasonsCount,
  episodesCount,
  studios = [],
  networks = [],
}: MediaSpecsCardProps) {
  const [endsAtText, setEndsAtText] = useState<string | null>(null);

  useEffect(() => {
    if (mediaType !== "movie") {
      setEndsAtText(null);
      return;
    }
    const mins = Number(runtimeMinutes || 0);
    if (!Number.isFinite(mins) || mins <= 0 || mins > 1440) {
      setEndsAtText(null);
      return;
    }

    const compute = () => {
      const end = new Date(Date.now() + mins * 60_000);
      setEndsAtText(
        end.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      );
    };

    compute();
    const timer = setInterval(compute, 30_000);
    return () => clearInterval(timer);
  }, [runtimeMinutes, mediaType]);

  const formattedLang = formatLanguage(language);
  const formattedBudget = formatFullCurrency(budget);
  const formattedRevenue = formatFullCurrency(revenue);

  const runtimeLabel = (() => {
    const mins = Number(runtimeMinutes || 0);
    if (!Number.isFinite(mins) || mins <= 0) return null;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`;
  })();

  const rows: { label: string; value: React.ReactNode }[] = [];

  if (mediaType === "movie") {
    if (runtimeLabel) {
      rows.push({
        label: "Runtime",
        value: (
          <span>
            <span className="text-white font-semibold">{runtimeLabel}</span>
            {endsAtText && (
              <span className="text-white/45 font-medium">
                {" "}
                • Ends {endsAtText}
              </span>
            )}
          </span>
        ),
      });
    }
    if (formattedLang) {
      rows.push({ label: "Language", value: formattedLang });
    }
    if (releaseDate) {
      rows.push({ label: "Release Date", value: releaseDate });
    }
    if (formattedBudget) {
      rows.push({ label: "Budget", value: formattedBudget });
    }
    if (formattedRevenue) {
      rows.push({ label: "Revenue", value: formattedRevenue });
    }
    if (!formattedBudget && !formattedRevenue && status) {
      rows.push({ label: "Status", value: status });
    }
  } else {
    if (status) {
      rows.push({ label: "Status", value: status });
    }
    if (formattedLang) {
      rows.push({ label: "Language", value: formattedLang });
    }
    if (releaseDate) {
      rows.push({ label: "First Aired", value: releaseDate });
    }
    if (lastAirDate) {
      rows.push({ label: "Last Aired", value: lastAirDate });
    }
    if (seasonsCount && seasonsCount > 0) {
      rows.push({ label: "Seasons", value: String(seasonsCount) });
    }
    if (episodesCount && episodesCount > 0) {
      rows.push({ label: "Episodes", value: String(episodesCount) });
    }
  }

  const primaryCompanies =
    mediaType === "tv" && networks.length > 0
      ? networks.map((n) => ({ ...n, kind: "network" as const }))
      : studios.map((s) => ({ ...s, kind: "studio" as const }));

  const withLogos = primaryCompanies.filter((c) => c.logo_path).slice(0, 3);
  const displayCompanies =
    withLogos.length > 0 ? withLogos : primaryCompanies.slice(0, 2);

  if (rows.length === 0 && displayCompanies.length === 0) return null;

  return (
    <div className="w-full lg:w-[325px] xl:w-[355px] shrink-0 flex flex-col items-center gap-5 select-text">
      {rows.length > 0 && (
        <div className="w-full rounded-2xl border border-white/[0.09] bg-white/[0.03] backdrop-blur-2xl divide-y divide-white/[0.07] overflow-hidden shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3 text-xs sm:text-[13px]"
            >
              <span className="text-white/45 font-medium shrink-0">
                {r.label}
              </span>
              <span className="text-white font-semibold text-right truncate">
                {r.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {displayCompanies.length > 0 && (
        <div className="flex items-center justify-center gap-6 sm:gap-8 flex-wrap px-2">
          {displayCompanies.map((comp, idx) => {
            const href =
              comp.kind === "network" && comp.id
                ? `/browse/network/${comp.id}?name=${encodeURIComponent(comp.name)}`
                : comp.id
                ? `/browse/studio/${comp.id}?name=${encodeURIComponent(comp.name)}&type=${mediaType}`
                : `/search?q=${encodeURIComponent(comp.name)}`;

            return (
              <StudioLogoMark
                key={`${comp.id || idx}-${comp.name}`}
                name={comp.name}
                logoPath={comp.logo_path}
                href={href}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});
