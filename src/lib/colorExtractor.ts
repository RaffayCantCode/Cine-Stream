export interface AmbientPalette {
  r: number;
  g: number;
  b: number;
  hex: string;
  cssVars: Record<string, string>;
}

const DEFAULT_COLOR = { r: 99, g: 102, b: 241, hex: "#6366f1" }; // Indigo fallback

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function componentToHex(c: number) {
  const hex = Math.round(c).toString(16);
  return hex.length === 1 ? "0" + hex : hex;
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

export function buildAmbientPalette(r: number, g: number, b: number): AmbientPalette {
  const hex = rgbToHex(r, g, b);
  return {
    r,
    g,
    b,
    hex,
    cssVars: {
      "--ambient-r": `${r}`,
      "--ambient-g": `${g}`,
      "--ambient-b": `${b}`,
      "--ambient-primary": `rgb(${r}, ${g}, ${b})`,
      "--ambient-glow": `rgba(${r}, ${g}, ${b}, 0.55)`,
      "--ambient-tint": `rgba(${r}, ${g}, ${b}, 0.15)`,
      "--ambient-subtle": `rgba(${r}, ${g}, ${b}, 0.08)`,
      "--ambient-border": `rgba(${r}, ${g}, ${b}, 0.35)`,
      "--ambient-radial": `radial-gradient(circle at 50% 30%, rgba(${r}, ${g}, ${b}, 0.38) 0%, rgba(${r}, ${g}, ${b}, 0.15) 45%, transparent 75%)`,
      "--ambient-spotlight": `radial-gradient(ellipse 90% 60% at 50% -10%, rgba(${r}, ${g}, ${b}, 0.42) 0%, rgba(${r}, ${g}, ${b}, 0.12) 50%, transparent 80%)`,
    },
  };
}

export async function extractDominantColor(imageUrl?: string | null): Promise<AmbientPalette> {
  if (!imageUrl || typeof window === "undefined") {
    return buildAmbientPalette(DEFAULT_COLOR.r, DEFAULT_COLOR.g, DEFAULT_COLOR.b);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";

    const timeout = setTimeout(() => {
      resolve(buildAmbientPalette(DEFAULT_COLOR.r, DEFAULT_COLOR.g, DEFAULT_COLOR.b));
    }, 2500);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(buildAmbientPalette(DEFAULT_COLOR.r, DEFAULT_COLOR.g, DEFAULT_COLOR.b));
          return;
        }

        const size = 48;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const imgData = ctx.getImageData(0, 0, size, size).data;
        let bestR = DEFAULT_COLOR.r;
        let bestG = DEFAULT_COLOR.g;
        let bestB = DEFAULT_COLOR.b;
        let maxScore = -1;

        // Sample pixels with step
        const step = 4;
        for (let i = 0; i < imgData.length; i += 4 * step) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          if (a < 180) continue;

          const { s, l } = rgbToHsl(r, g, b);

          // Discard dark mud, washed-out whites, and desaturated grays
          if (l < 22 || l > 85 || s < 25) continue;

          // Score vibrant saturated midtones
          const saturationBonus = s / 100;
          const lightnessFitness = 1 - Math.abs(l - 50) / 50;
          const score = saturationBonus * 2.2 + lightnessFitness * 1.0;

          if (score > maxScore) {
            maxScore = score;
            bestR = r;
            bestG = g;
            bestB = b;
          }
        }

        resolve(buildAmbientPalette(bestR, bestG, bestB));
      } catch {
        resolve(buildAmbientPalette(DEFAULT_COLOR.r, DEFAULT_COLOR.g, DEFAULT_COLOR.b));
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(buildAmbientPalette(DEFAULT_COLOR.r, DEFAULT_COLOR.g, DEFAULT_COLOR.b));
    };

    img.src = imageUrl;
  });
}
