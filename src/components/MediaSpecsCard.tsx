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
  }, [runtimeMinutes]);

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
    if (runtimeLabel && rows.length < 5) {
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
  }

  // Prefer networks with logos on TV, studios with logos on Movie
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
        <div className="flex items-center justify-center gap-7 sm:gap-9 flex-wrap px-2">
          {displayCompanies.map((comp, idx) => {
            const href =
              comp.kind === "network" && comp.id
                ? `/browse/network/${comp.id}?name=${encodeURIComponent(comp.name)}`
                : comp.id
                ? `/browse/studio/${comp.id}?name=${encodeURIComponent(comp.name)}&type=${mediaType}`
                : `/search?q=${encodeURIComponent(comp.name)}`;

            return (
              <Link
                key={`${comp.id || idx}-${comp.name}`}
                href={href}
                title={`Browse all titles from ${comp.name}`}
                className="group inline-flex items-center justify-center opacity-70 hover:opacity-100 transition-all duration-200 hover:scale-105"
              >
                {comp.logo_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w300${comp.logo_path}`}
                    alt={comp.name}
                    className="max-h-8 sm:max-h-10 max-w-[115px] sm:max-w-[130px] w-auto object-contain brightness-0 invert"
                  />
                ) : (
                  <span className="text-xs sm:text-sm font-black uppercase tracking-[0.18em] text-white/75 group-hover:text-white">
                    {comp.name}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
});
