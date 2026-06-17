export interface Provider {
  id: number;
  name: string;
  slug: string;
  color: string;
  textColor: string;
  region: string;
  short: string;
  /**
   * TMDB with_watch_monetization_types override.
   * Defaults to "flatrate" if not set.
   * Use pipe-separated values for OR logic (e.g. "flatrate|ads|free").
   */
  monetizationTypes?: string;
  /**
   * Additional provider IDs to OR-combine with the primary id.
   * Some platforms have multiple TMDB entries (e.g. Peacock + Peacock Premium).
   */
  additionalIds?: number[];
}

export const PROVIDERS: Provider[] = [
  { id: 8,    name: "Netflix",     slug: "netflix",        color: "#E50914", textColor: "#FFFFFF", region: "US", short: "N"   },
  { id: 337,  name: "Disney+",     slug: "disney-plus",    color: "#113CCF", textColor: "#FFFFFF", region: "US", short: "D+"  },
  { id: 9,    name: "Prime Video", slug: "prime-video",    color: "#00A8E1", textColor: "#FFFFFF", region: "US", short: "PV", monetizationTypes: "flatrate|rent|buy" },
  // Apple TV+ correct TMDB ID is 2 (350 = Apple TV store / Sky in some regions)
  { id: 2,    name: "Apple TV+",   slug: "apple-tv-plus",  color: "#111111", textColor: "#FFFFFF", region: "US", short: "tv"  },
  { id: 15,   name: "Hulu",        slug: "hulu",           color: "#1CE783", textColor: "#04141A", region: "US", short: "h",  monetizationTypes: "flatrate|ads" },
  // Max (formerly HBO Max) — rebranded provider ID is 1899
  { id: 1899, name: "Max",         slug: "hbo-max",        color: "#7B2CBF", textColor: "#FFFFFF", region: "US", short: "MAX" },
  { id: 531,  name: "Paramount+",  slug: "paramount-plus", color: "#0064FF", textColor: "#FFFFFF", region: "US", short: "P+", monetizationTypes: "flatrate|ads" },
  // Peacock has both free (386) and premium (387) tiers — combine both IDs
  { id: 386,  name: "Peacock",     slug: "peacock",        color: "#F25C00", textColor: "#FFFFFF", region: "US", short: "P",  monetizationTypes: "flatrate|ads|free", additionalIds: [387] },
];

export function getProviderBySlug(slug: string): Provider | undefined {
  return PROVIDERS.find((p) => p.slug === slug);
}
