export type ThemeId = string;

export interface ThemeDefinition {
  id: string;
  label: string;
  tagline: string;
  description: string;
  /** Left-to-right gradient used for the preview card / swatch. */
  preview: string;
  /** Accent color swatch used in the preview chrome. */
  accent: string;
  isCustom?: boolean;
  background?: string;
  card?: string;
  primary?: string;
  foreground?: string;
}

export const THEME_STORAGE_KEY = "cinestream.theme";
export const CUSTOM_THEMES_STORAGE_KEY = "cinestream.custom_themes";

export const DEFAULT_THEME = "global";

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

export function parseHexToHslObj(hex: string): { h: number; s: number; l: number } {
  if (!hex) return { h: 210, s: 30, l: 6 };
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const num = parseInt(hex, 16);
  if (isNaN(num)) return { h: 210, s: 30, l: 6 };
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export type ArchetypeStyle = "midnight" | "glass" | "oled" | "velvet" | "forest" | "cosmos";

export function harmonizeAccentToCineStreamTheme(accentHex: string, archetype: ArchetypeStyle = "midnight") {
  const { h } = parseHexToHslObj(accentHex || "#38BDF8");

  let bgL = 5.5, bgS = 25;
  let cardL = 12, cardS = 20;

  if (archetype === "oled") {
    bgL = 0; bgS = 0;
    cardL = 7; cardS = 10;
  } else if (archetype === "glass") {
    bgL = 6.5; bgS = 28;
    cardL = 13; cardS = 22;
  } else if (archetype === "velvet") {
    bgL = 5; bgS = 35;
    cardL = 11; cardS = 25;
  } else if (archetype === "forest") {
    bgL = 5.5; bgS = 30;
    cardL = 11; cardS = 22;
  } else if (archetype === "cosmos") {
    bgL = 6; bgS = 35;
    cardL = 12; cardS = 25;
  }

  const background = archetype === "oled" ? "#000000" : hslToHex(h, bgS, bgL);
  const card = hslToHex(h, cardS, cardL);
  const primary = hslToHex(h, 85, 58);
  const accent = hslToHex((h + 30) % 360, 85, 62);
  const foreground = "#F1F5F9";

  return {
    background,
    card,
    primary,
    accent,
    foreground,
  };
}

export function hexToHsl(hex: string): string {
  if (!hex) return "210 30% 6%";
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const num = parseInt(hex, 16);
  if (isNaN(num)) return "210 30% 6%";
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const BUILTIN_THEMES = new Set<string>(THEMES.map((t) => t.id));

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return !!value && (BUILTIN_THEMES.has(value) || value.startsWith("custom_"));
}

export function getTheme(id: ThemeId, customList: ThemeDefinition[] = []): ThemeDefinition {
  const builtin = THEMES.find((t) => t.id === id);
  if (builtin) return builtin;
  const custom = customList.find((t) => t.id === id);
  if (custom) return custom;
  return THEMES[0];
}