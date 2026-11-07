/**
 * Cover palette extraction.
 *
 * Samples an anime cover/poster and derives two vibrant, readable accent
 * colours so detail pages can echo the artwork instead of always falling back
 * to the same blue/fuchsia theme.
 *
 * Everything runs client-side against a tiny canvas sample (60×90), so it costs
 * almost nothing and never blocks rendering. If the image is cross-origin
 * without CORS headers (tainted canvas) or fails to load, the caller keeps its
 * default palette.
 */

export type Rgb = { r: number; g: number; b: number };

export type CoverPalette = {
  accent: string;
  accent2: string;
  accentRgb: Rgb;
  accent2Rgb: Rgb;
};

const FALLBACK_ACCENT: Rgb = { r: 114, g: 136, b: 174 }; // #7288AE
const FALLBACK_ACCENT_2: Rgb = { r: 217, g: 70, b: 239 }; // #D946EF

export const DEFAULT_COVER_PALETTE: CoverPalette = {
  accent: rgbToHex(FALLBACK_ACCENT),
  accent2: rgbToHex(FALLBACK_ACCENT_2),
  accentRgb: FALLBACK_ACCENT,
  accent2Rgb: FALLBACK_ACCENT_2,
};

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const int = parseInt(full, 16);
  if (Number.isNaN(int)) return FALLBACK_ACCENT;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function withAlpha({ r, g, b }: Rgb, alpha: number): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

/** Returns a text colour that reads well on top of the given background. */
export function readableTextOn({ r, g, b }: Rgb): string {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  return contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#0b0d12";
}

type Hsl = { h: number; s: number; l: number };

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = 60 * (((gn - bn) / delta) % 6);
        break;
      case gn:
        h = 60 * ((bn - rn) / delta + 2);
        break;
      default:
        h = 60 * ((rn - gn) / delta + 4);
    }
  }
  if (h < 0) h += 360;
  return { h, s: Math.min(1, Math.max(0, s)), l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hp < 1) [rp, gp, bp] = [c, x, 0];
  else if (hp < 2) [rp, gp, bp] = [x, c, 0];
  else if (hp < 3) [rp, gp, bp] = [0, c, x];
  else if (hp < 4) [rp, gp, bp] = [0, x, c];
  else if (hp < 5) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  const m = l - c / 2;
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

/** Lift a sampled colour until it is vibrant and bright enough for dark UI. */
function boost(rgb: Rgb, hueShift = 0): Rgb {
  const { h, s, l } = rgbToHsl(rgb);
  return hslToRgb({
    h: h + hueShift,
    s: Math.min(0.92, Math.max(0.55, s)),
    l: Math.min(0.7, Math.max(0.5, l)),
  });
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function hueOf(rgb: Rgb): number {
  return rgbToHsl(rgb).h;
}

const paletteCache = new Map<string, CoverPalette | null>();

/**
 * Build an accent pair from a single seed colour (AniList exposes one dominant
 * cover colour, which is far cheaper and more reliable than canvas sampling).
 */
export function buildPaletteFromColor(hex?: string | null): CoverPalette | null {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex.trim())) return null;
  const rgb = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(rgb);
  // Greyscale seeds have no meaningful hue — let the caller sample the artwork
  // instead. Dark/muted seeds are fine: `boost` lifts them into a usable range.
  if (s < 0.12 || l < 0.03 || l > 0.97) return null;

  const hueShift = h >= 30 && h <= 150 ? -32 : 32;
  const accentRgb = boost(rgb);
  const accent2Rgb = boost(rgb, hueShift);

  return {
    accent: rgbToHex(accentRgb),
    accent2: rgbToHex(accent2Rgb),
    accentRgb,
    accent2Rgb,
  };
}

/**
 * Deterministic palette derived from an anime's id/title.
 *
 * Used as the very first paint while the real cover colour is being resolved,
 * so no page ever flashes the shared default (blue/fuchsia) theme.
 */
export function buildPaletteFromSeed(seed: string): CoverPalette {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hue = Math.abs(hash) % 360;
  const accentRgb = boost(hslToRgb({ h: hue, s: 0.62, l: 0.58 }));
  const accent2Rgb = boost(hslToRgb({ h: hue + 38, s: 0.66, l: 0.56 }));
  return {
    accent: rgbToHex(accentRgb),
    accent2: rgbToHex(accent2Rgb),
    accentRgb,
    accent2Rgb,
  };
}

const ANILIST_COLOR_CACHE_PREFIX = "cs_cover_color_";
/** De-duplicates concurrent colour lookups for the same title. */
const colorRequests = new Map<string, Promise<string | null>>();

/**
 * Fetch a cover's dominant colour straight from AniList in the browser.
 *
 * The server-side meta pipeline can be blocked from AniList (edge hosts are
 * commonly challenged), which used to leave every page on the default palette.
 * AniList's GraphQL API is CORS-enabled, so the browser can resolve the colour
 * directly — a tiny request (~1 KB) that runs in parallel with the page.
 */
export function fetchAniListCoverColor(mediaId?: string | number | null): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const raw = String(mediaId ?? "").trim();
  // Only real AniList ids — Kitsu ids look like "kitsu-123".
  if (!/^\d+$/.test(raw)) return Promise.resolve(null);
  const id = parseInt(raw, 10);
  if (!id) return Promise.resolve(null);

  const cacheKey = `${ANILIST_COLOR_CACHE_PREFIX}${id}`;
  try {
    const cached = window.sessionStorage.getItem(cacheKey);
    if (cached !== null) return Promise.resolve(cached || null);
  } catch {}

  const inFlight = colorRequests.get(cacheKey);
  if (inFlight) return inFlight;

  const request = (async (): Promise<string | null> => {
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4500);
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          query: "query ($id: Int) { Media(id: $id, type: ANIME) { coverImage { color } } }",
          variables: { id },
        }),
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      if (!res.ok) return null;
      const json = await res.json();
      const color: string | null = json?.data?.Media?.coverImage?.color || null;
      try {
        window.sessionStorage.setItem(cacheKey, color || "");
      } catch {}
      return color;
    } catch {
      return null;
    } finally {
      colorRequests.delete(cacheKey);
    }
  })();

  colorRequests.set(cacheKey, request);
  return request;
}

/**
 * Route a remote image through our own origin so canvas sampling can never be
 * CORS-tainted (this is the reliable fallback when AniList's colour is missing
 * or greyscale).
 */
export function proxiedImageUrl(src?: string | null): string | null {
  if (!src) return null;
  return `/api/image-proxy?url=${encodeURIComponent(src)}`;
}

function computePalette(img: HTMLImageElement): CoverPalette | null {
  if (!img.naturalWidth || !img.naturalHeight) return null;

  const w = 60;
  const h = 90;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  // Cover-crop the poster so the sample keeps its original composition.
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    // Tainted canvas — the CDN did not allow CORS reads.
    return null;
  }

  type Bucket = { count: number; r: number; g: number; b: number };
  const buckets = new Map<number, Bucket>();

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 160) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  if (buckets.size === 0) return null;

  const candidates = [...buckets.values()].map((bucket) => {
    const rgb: Rgb = {
      r: bucket.r / bucket.count,
      g: bucket.g / bucket.count,
      b: bucket.b / bucket.count,
    };
    const { s, l } = rgbToHsl(rgb);
    return { rgb, count: bucket.count, s, l };
  });

  const maxCount = Math.max(...candidates.map((c) => c.count));

  const scoreOf = (c: (typeof candidates)[number]) => {
    const lightnessWeight = Math.max(0.12, 1 - Math.abs(c.l - 0.55) * 1.35);
    return (c.count / maxCount) * (0.35 + c.s) * lightnessWeight;
  };

  // Prefer colourful, mid-tone pixels; relax if the cover is monochrome.
  const isUsable = (c: (typeof candidates)[number], minSat: number) =>
    c.s >= minSat && c.l >= 0.1 && c.l <= 0.94;

  let usable = candidates.filter((c) => isUsable(c, 0.18));
  if (usable.length === 0) usable = candidates.filter((c) => isUsable(c, 0.06));
  if (usable.length === 0) return null;

  usable.sort((a, b) => scoreOf(b) - scoreOf(a));

  const primary = usable[0];
  const primaryHue = hueOf(primary.rgb);

  // Second accent: pick a different hue cluster when possible.
  const secondary =
    usable
      .slice(1)
      .filter((c) => hueDistance(hueOf(c.rgb), primaryHue) >= 40)
      .sort((a, b) => scoreOf(b) - scoreOf(a))[0] || null;

  const accentRgb = boost(primary.rgb);
  const accent2Rgb = secondary
    ? boost(secondary.rgb)
    : boost(primary.rgb, primaryHue < 200 ? 42 : -42);

  return {
    accent: rgbToHex(accentRgb),
    accent2: rgbToHex(accent2Rgb),
    accentRgb,
    accent2Rgb,
  };
}

/**
 * Extract a palette from an image URL. Resolves `null` when extraction is not
 * possible (cross-origin canvas, network error, timeout) so callers can keep
 * the default theme.
 */
export function extractCoverPalette(src?: string | null): Promise<CoverPalette | null> {
  if (!src || typeof window === "undefined") return Promise.resolve(null);
  if (paletteCache.has(src)) return Promise.resolve(paletteCache.get(src) ?? null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (palette: CoverPalette | null) => {
      if (settled) return;
      settled = true;
      paletteCache.set(src, palette);
      resolve(palette);
    };

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.decoding = "async";

    const timer = window.setTimeout(() => finish(null), 8000);

    img.onload = () => {
      window.clearTimeout(timer);
      try {
        finish(computePalette(img));
      } catch {
        finish(null);
      }
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };

    img.src = src;
  });
}
