interface ProviderIconProps {
  slug: string;
  className?: string;
}

const PROVIDER_LOGO_URLS: Record<string, string> = {
  "netflix": "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/netflix.svg",
  "disney-plus": "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/disneyplus.svg",
  "prime-video": "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/amazonprime.svg",
  "apple-tv-plus": "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/appletv.svg",
  "hulu": "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/hulu.svg",
  "hbo-max": "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/hbomax.svg",
  "paramount-plus": "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/paramountplus.svg",
  "peacock": "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/peacock.svg",
};

export function ProviderIcon({ slug, className }: ProviderIconProps) {
  const src = PROVIDER_LOGO_URLS[slug];
  if (!src) return null;
  return (
    <img
      src={src}
      alt={slug}
      className={className}
      style={{ filter: "brightness(0) invert(1)" }}
    />
  );
}
