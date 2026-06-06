export interface Provider {
  id: number;
  name: string;
  slug: string;
  color: string;
  textColor: string;
  region: string;
  short: string;
}

export const PROVIDERS: Provider[] = [
  { id: 8, name: "Netflix", slug: "netflix", color: "#E50914", textColor: "#FFFFFF", region: "US", short: "N" },
  { id: 337, name: "Disney+", slug: "disney-plus", color: "#113CCF", textColor: "#FFFFFF", region: "US", short: "D+" },
  { id: 9, name: "Prime Video", slug: "prime-video", color: "#00A8E1", textColor: "#FFFFFF", region: "US", short: "PV" },
  { id: 350, name: "Apple TV+", slug: "apple-tv-plus", color: "#111111", textColor: "#FFFFFF", region: "US", short: "tv" },
  { id: 15, name: "Hulu", slug: "hulu", color: "#1CE783", textColor: "#04141A", region: "US", short: "h" },
  { id: 384, name: "HBO Max", slug: "hbo-max", color: "#7B2CBF", textColor: "#FFFFFF", region: "US", short: "HBO" },
  { id: 531, name: "Paramount+", slug: "paramount-plus", color: "#0064FF", textColor: "#FFFFFF", region: "US", short: "P+" },
  { id: 386, name: "Peacock", slug: "peacock", color: "#F25C00", textColor: "#FFFFFF", region: "US", short: "P" },
];

export function getProviderBySlug(slug: string): Provider | undefined {
  return PROVIDERS.find((p) => p.slug === slug);
}
