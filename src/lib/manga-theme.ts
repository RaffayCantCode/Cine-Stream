/**
 * Manga / Manhwa visual identity.
 *
 * - Manga  -> strict monochrome (paper white + ink black)
 * - Manhwa -> electric violet (#9d03fc) to hot magenta (#fc03ad)
 * - Manhua -> a slightly cooler violet sibling of manhwa
 *
 * The palette is exposed both as raw CSS variables (space separated HSL,
 * so Tailwind's hsl(var(--primary)) keeps working) and as ready made classes.
 */

export type MangaKind = "manga" | "manhwa" | "manhua";

export interface MangaTheme {
  kind: MangaKind;
  label: string;
  isManhwa: boolean;
  /** Space separated HSL triplets for CSS custom properties. */
  primaryHsl: string;
  primaryForegroundHsl: string;
  accentHsl: string;
  accentForegroundHsl: string;
  /** Solid brand colours. */
  primaryHex: string;
  accentHex: string;
  /** Gradients. */
  gradient: string;
  gradientSoft: string;
  halo: string;
  border: string;
  /** Text colours. */
  text: string;
  softText: string;
  /** Composable class helpers (kept here so they stay consistent). */
  chipClass: string;
  titleHoverClass: string;
  tagTextClass: string;
  cardHoverClass: string;
  sectionIconClass: string;
  activePillClass: string;
  ghostButtonClass: string;
}

const MANHWA_THEME: MangaTheme = {
  kind: "manhwa",
  label: "Manhwa",
  isManhwa: true,
  primaryHsl: "277 98% 50%", // #9d03fc
  primaryForegroundHsl: "0 0% 100%",
  accentHsl: "319 98% 50%", // #fc03ad
  accentForegroundHsl: "0 0% 100%",
  primaryHex: "#9d03fc",
  accentHex: "#fc03ad",
  gradient: "linear-gradient(135deg, #9d03fc 0%, #d506d8 52%, #fc03ad 100%)",
  gradientSoft:
    "linear-gradient(135deg, rgba(157,3,252,0.20) 0%, rgba(252,3,173,0.20) 100%)",
  halo: "rgba(157, 3, 252, 0.38)",
  border: "rgba(200, 64, 255, 0.55)",
  text: "#e6b8ff",
  softText: "#d8a4f5",
  chipClass:
    "bg-[linear-gradient(135deg,#9d03fc_0%,#d506d8_52%,#fc03ad_100%)] text-white border-white/25 shadow-[0_6px_18px_rgba(157,3,252,0.45)]",
  titleHoverClass: "group-hover:text-[#e6b8ff]",
  tagTextClass: "text-[#e6b8ff]",
  cardHoverClass:
    "hover:border-[#b62bff]/70 hover:shadow-[0_18px_44px_-12px_rgba(157,3,252,0.55)]",
  sectionIconClass: "bg-[linear-gradient(135deg,#9d03fc_0%,#fc03ad_100%)] text-white",
  activePillClass:
    "bg-[linear-gradient(135deg,#9d03fc_0%,#fc03ad_100%)] text-white border-transparent shadow-[0_10px_26px_-8px_rgba(157,3,252,0.7)]",
  ghostButtonClass:
    "border-[#b62bff]/35 bg-[rgba(157,3,252,0.10)] text-[#e6b8ff] hover:bg-[rgba(157,3,252,0.20)] hover:border-[#c840ff]/60",
};

const MANHUA_THEME: MangaTheme = {
  ...MANHWA_THEME,
  kind: "manhua",
  label: "Manhua",
  primaryHsl: "269 94% 58%",
  accentHsl: "296 94% 52%",
  primaryHex: "#8b2ff2",
  accentHex: "#d61fd6",
  gradient: "linear-gradient(135deg, #8b2ff2 0%, #bf28e6 55%, #d61fd6 100%)",
  gradientSoft:
    "linear-gradient(135deg, rgba(139,47,242,0.20) 0%, rgba(214,31,214,0.20) 100%)",
  halo: "rgba(139, 47, 242, 0.35)",
  border: "rgba(191, 40, 230, 0.5)",
  text: "#ddb8ff",
  softText: "#cf9ff5",
  chipClass:
    "bg-[linear-gradient(135deg,#8b2ff2_0%,#d61fd6_100%)] text-white border-white/25 shadow-[0_6px_18px_rgba(139,47,242,0.42)]",
  titleHoverClass: "group-hover:text-[#ddb8ff]",
  tagTextClass: "text-[#ddb8ff]",
  cardHoverClass:
    "hover:border-[#a845ff]/70 hover:shadow-[0_18px_44px_-12px_rgba(139,47,242,0.5)]",
  sectionIconClass:
    "bg-[linear-gradient(135deg,#8b2ff2_0%,#d61fd6_100%)] text-white",
  activePillClass:
    "bg-[linear-gradient(135deg,#8b2ff2_0%,#d61fd6_100%)] text-white border-transparent shadow-[0_10px_26px_-8px_rgba(139,47,242,0.65)]",
  ghostButtonClass:
    "border-[#a845ff]/35 bg-[rgba(139,47,242,0.10)] text-[#ddb8ff] hover:bg-[rgba(139,47,242,0.20)] hover:border-[#bf50ff]/60",
};

const MANGA_THEME: MangaTheme = {
  kind: "manga",
  label: "Manga",
  isManhwa: false,
  primaryHsl: "0 0% 100%",
  primaryForegroundHsl: "0 0% 4%",
  accentHsl: "0 0% 72%",
  accentForegroundHsl: "0 0% 4%",
  primaryHex: "#ffffff",
  accentHex: "#a1a1aa",
  gradient: "linear-gradient(135deg, #ffffff 0%, #d4d4d8 55%, #a1a1aa 100%)",
  gradientSoft:
    "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)",
  halo: "rgba(255, 255, 255, 0.22)",
  border: "rgba(255, 255, 255, 0.45)",
  text: "#ffffff",
  softText: "rgba(255,255,255,0.72)",
  chipClass:
    "bg-white text-black border-white/70 shadow-[0_6px_18px_rgba(255,255,255,0.22)]",
  titleHoverClass: "group-hover:text-white",
  tagTextClass: "text-white",
  cardHoverClass:
    "hover:border-white/60 hover:shadow-[0_18px_44px_-14px_rgba(255,255,255,0.32)]",
  sectionIconClass: "bg-white text-black",
  activePillClass:
    "bg-white text-black border-transparent shadow-[0_10px_26px_-10px_rgba(255,255,255,0.6)]",
  ghostButtonClass:
    "border-white/20 bg-white/[0.06] text-white hover:bg-white/[0.13] hover:border-white/40",
};

const THEME_MAP: Record<MangaKind, MangaTheme> = {
  manga: MANGA_THEME,
  manhwa: MANHWA_THEME,
  manhua: MANHUA_THEME,
};

export function getMangaTheme(type?: string | null): MangaTheme {
  const kind = (type || "manga").toLowerCase();
  if (kind === "manhwa") return THEME_MAP.manhwa;
  if (kind === "manhua") return THEME_MAP.manhua;
  return THEME_MAP.manga;
}

/** Only manhwa / manhua get the violet-magenta identity. */
export function isManhwaKind(type?: string | null): boolean {
  return getMangaTheme(type).isManhwa;
}

/**
 * Resolves the most reliable kind for a series using the same heuristics the
 * rest of the manga stack relies on (explicit type, tags, source id, title).
 */
export function resolveMangaKind(opts: {
  type?: string | null;
  tags?: string[] | null;
  title?: string | null;
  id?: string | null;
}): MangaKind {
  const tags = (opts.tags || []).map((tag) => String(tag).toLowerCase());

  if (
    tags.some(
      (tag) =>
        tag.includes("manhwa") ||
        tag.includes("webtoon") ||
        tag.includes("korean")
    )
  ) {
    return "manhwa";
  }

  if (tags.some((tag) => tag.includes("manhua") || tag.includes("chinese"))) {
    return "manhua";
  }

  const raw = (opts.type || "").toLowerCase();
  if (raw === "manhwa" || raw === "manhua") return raw;

  if ((opts.id || "").startsWith("asura-")) return "manhwa";

  if (
    /infinite mage|solo leveling|raeliana|duke's mansion|tower of god|god of high school|lookism|omniscient reader|return of the mount hua sect|wind breaker|nano machine/i.test(
      opts.title || ""
    )
  ) {
    return "manhwa";
  }

  return "manga";
}

/** Inline CSS variables for a section / page themed around a kind. */
export function mangaThemeStyle(type?: string | null): Record<string, string> {
  const theme = getMangaTheme(type);
  return {
    ["--primary"]: theme.primaryHsl,
    ["--primary-foreground"]: theme.primaryForegroundHsl,
    ["--ring"]: theme.primaryHsl,
    ["--accent"]: theme.accentHsl,
    ["--accent-foreground"]: theme.accentForegroundHsl,
    ["--manga-accent"]: theme.primaryHex,
    ["--manga-accent-2"]: theme.accentHex,
  };
}

export { MANGA_THEME, MANHWA_THEME, MANHUA_THEME };
