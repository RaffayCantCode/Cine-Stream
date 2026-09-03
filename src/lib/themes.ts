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
    tagline: "Dynamic Ambient",
    description: "Dynamic adaptive atmosphere where page background colors seamlessly morph with active banner artwork.",
    preview: "linear-gradient(135deg, #0B1424 0%, #152238 60%, #1E2D4A 100%)",
    accent: "#6366F1",
    background: "#0B1424",
    card: "#18253B",
    primary: "#6366F1",
  },
  {
    id: "glass",
    label: "Glass",
    tagline: "Liquid Glass",
    description: "Fluid refractive liquid glass — multi-spectral animated aurora with floating frosted crystal surfaces.",
    preview: "linear-gradient(135deg, #0d162d 0%, #172554 50%, #38BDF8 100%)",
    accent: "#38BDF8",
    background: "#080d1e",
    card: "#111a36",
    primary: "#38BDF8",
  },
  {
    id: "oled",
    label: "OLED",
    tagline: "True Black & Red",
    description: "Pure AMOLED black with punchy high-contrast red text, glowing red accents, and infinite contrast.",
    preview: "linear-gradient(135deg, #000000 0%, #100003 60%, #FF0B16 100%)",
    accent: "#FF0B16",
    background: "#000000",
    card: "#000000",
    primary: "#FF0B16",
  },
  {
    id: "cinema",
    label: "Cinema",
    tagline: "Velvet & Gold",
    description: "Grand theater atmosphere — velvet burgundy noir with glowing imperial gold and theatrical spotlights.",
    preview: "linear-gradient(135deg, #140509 0%, #2a0812 60%, #F59E0B 100%)",
    accent: "#F59E0B",
    background: "#140509",
    card: "#200a10",
    primary: "#F59E0B",
  },
  {
    id: "wisteria",
    label: "Wisteria",
    tagline: "Electric Bloom",
    description: "Midnight violet cosmos with radiant wisteria bloom, electric lilac, and neon magenta pink.",
    preview: "linear-gradient(135deg, #0e071c 0%, #1e0b38 60%, #E879F9 100%)",
    accent: "#E879F9",
    background: "#0e071c",
    card: "#1a0e30",
    primary: "#E879F9",
  },
  {
    id: "solaris",
    label: "Solaris",
    tagline: "Solar Flare",
    description: "Deep eclipse space with blazing solar flare gold, fiery amber glow, and warm sunbeams.",
    preview: "linear-gradient(135deg, #100b05 0%, #261406 60%, #F59E0B 100%)",
    accent: "#F59E0B",
    background: "#100b05",
    card: "#1e140a",
    primary: "#F59E0B",
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