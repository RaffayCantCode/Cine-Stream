export function editDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[] = [];
  for (let i = 0; i <= bn; i++) matrix[i] = i;
  for (let i = 1; i <= an; i++) {
    let prev = i;
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const val = Math.min(
        matrix[j] + 1,
        prev + 1,
        matrix[j - 1] + cost,
        i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]
          ? matrix[j - 2] + cost : Infinity
      );
      matrix[j - 1] = prev;
      prev = val;
    }
    matrix[bn] = prev;
  }
  return matrix[bn];
}

const COMMON_VOWELS: Record<string, string> = { a: "e", e: "i", i: "o", o: "u", u: "a" };
const ADJACENT_KEYS: Record<string, string> = {
  q: "w", w: "e", e: "r", r: "t", t: "y", y: "u", u: "i", i: "o", o: "p",
  a: "s", s: "d", d: "f", f: "g", g: "h", h: "j", j: "k", k: "l",
  z: "x", x: "c", c: "v", v: "b", b: "n", n: "m",
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export function generateVariants(query: string, maxVariants = 8): string[] {
  const normalized = normalize(query);
  if (!normalized) return [];
  const variants = new Set<string>();
  const chars = [...normalized];

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c >= "a" && c <= "z") {
      const adj = ADJACENT_KEYS[c];
      if (adj) {
        const replaced = [...chars]; replaced[i] = adj; variants.add(replaced.join(""));
        const swapped = [...chars]; swapped[i] = adj.toUpperCase(); variants.add(swapped.join("").toLowerCase());
      }
      const vowel = COMMON_VOWELS[c];
      if (vowel && vowel !== c) {
        const replaced = [...chars]; replaced[i] = vowel; variants.add(replaced.join(""));
      }
    }
    if (i < chars.length - 1) {
      const swapped = [...chars]; [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]]; variants.add(swapped.join(""));
    }
    const deleted = [...chars]; deleted.splice(i, 1); variants.add(deleted.join(""));
    const doubled = [...chars]; doubled.splice(i, 0, c); variants.add(doubled.join(""));
  }

  const words = normalized.split(" ").filter(Boolean);
  if (words.length > 1) {
    for (let i = 0; i < words.length; i++) {
      const without = [...words]; without.splice(i, 1); variants.add(without.join(" "));
    }
    for (let i = 0; i < words.length - 1; i++) {
      const merged = [...words]; merged[i] = merged[i] + merged[i + 1]; merged.splice(i + 1, 1); variants.add(merged.join(" "));
    }
  }
  if (words.length === 1 && normalized.length > 4) {
    const splits = [];
    for (let i = 2; i < normalized.length - 1; i++) {
      splits.push(normalized.slice(0, i) + " " + normalized.slice(i));
    }
    splits.sort((a, b) => Math.abs(a.length / 2 - a.indexOf(" ")) - Math.abs(b.length / 2 - b.indexOf(" ")));
    variants.add(splits[0]);
    if (splits.length > 1) variants.add(splits[1]);
  }

  return [...variants].filter(v => v.length >= 2 && v !== normalized).slice(0, maxVariants);
}

export function findBestSuggestion(
  query: string,
  candidates: string[],
  maxDistance = 3
): { suggestion: string; distance: number } | null {
  if (!query || !candidates.length) return null;
  const normalizedQuery = normalize(query);
  let best: { suggestion: string; distance: number } | null = null;
  for (const candidate of candidates) {
    const dist = editDistance(normalizedQuery, normalize(candidate));
    if (dist <= maxDistance && (!best || dist < best.distance)) {
      best = { suggestion: candidate, distance: dist };
    }
  }
  return best;
}

export function getTitleExtractor(item: any): string {
  return item.title || item.name || item.original_title || item.original_name || "";
}

export function computeWordOverlap(query: string, title: string): number {
  const qWords = new Set(normalize(query).split(" ").filter(w => w.length > 2));
  const tWords = new Set(normalize(title).split(" ").filter(w => w.length > 2));
  if (!qWords.size || !tWords.size) return 0;
  let matches = 0;
  for (const qw of qWords) {
    for (const tw of tWords) {
      if (qw === tw || editDistance(qw, tw) <= 1) { matches++; break; }
    }
  }
  return matches / qWords.size;
}
