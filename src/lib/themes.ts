export type ThemeId = "global" | "glass" | "oled" | "cinema" | "wisteria" | "solaris";

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  tagline: string;
  description: string;
  /** Left-to-right gradient used for the preview card / swatch. */
  preview: string;
  /** Accent color swatch used in the preview chrome. */
  accent: string;
}

export const THEME_STORAGE_KEY = "cinestream.theme";

export const DEFAULT_THEME: ThemeId = "global";

export const THEMES: ThemeDefinition[] = [
  {
    id: "global",
    label: "Global",
    tagline: "Default",
    description: "The classic CineStream midnight experience with vibrant red, green and purple accents.",
    preview: "linear-gradient(135deg, #0B1424 0%, #1B2A45 45%, #33415C 100%)",
    accent: "#6366F1",
  },
  {
    id: "glass",
    label: "Glass",
    tagline: "Premium",
    description: "Premium liquid glass — frosted, refractive surfaces with color, depth and a luminous float.",
    preview: "linear-gradient(135deg, #0B0E1A 0%, #22284A 40%, #3E4E86 70%, #0E1420 100%)",
    accent: "#8FA8F2",
  },
  {
    id: "oled",
    label: "OLED",
    tagline: "True Black",
    description: "Pure AMOLED black for deep contrast, sharp posters and better battery life.",
    preview: "linear-gradient(135deg, #000000 0%, #0A0A0C 55%, #1A1A1F 100%)",
    accent: "#E63946",
  },
{
    id: "cinema",
    label: "Cinema",
    tagline: "Theatre",
    description: "Velvet burgundy and rich gold. A luxurious movie-palace mood, bathed in glowing brass and crimson.",
    preview: "linear-gradient(135deg, #20060B 0%, #5A1020 45%, #8A5A1E 100%)",
    accent: "#F2C14E",
  },
  {
    id: "wisteria",
    label: "Wisteria",
    tagline: "Bloom",
    description: "Rich Wisteria Bloom palette blending deep electric violet, ice lavender, thistle orchid, and radiant magenta pink.",
    preview: "linear-gradient(135deg, #120C24 0%, #9400D3 35%, #ED80E9 70%, #D3D3FF 100%)",
    accent: "#ED80E9",
  },
  {
    id: "solaris",
    label: "Solaris",
    tagline: "Lemon",
    description: "Multi-layered Zesty Lemon palette combining sun yellow, sunshine gold, warm olive sage, and deep olive brass.",
    preview: "linear-gradient(135deg, #14160A 0%, #B3B347 35%, #D6D58B 65%, #FFFF66 100%)",
    accent: "#FFFF66",
  },
];

const VALID_THEMES = new Set<string>(THEMES.map((t) => t.id));

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return !!value && VALID_THEMES.has(value);
}

export function getTheme(id: ThemeId): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}