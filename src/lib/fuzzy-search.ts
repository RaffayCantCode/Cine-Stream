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
  z: "x", x: "c", c: "v", v: "b", b: "n", n: "m", m: "n", l: "n",
};

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export function generateSearchCandidates(query: string): string[] {
  const normalized = normalize(query);
  if (!normalized) return [];
  const candidates = new Set<string>();

  // 1. Swap adjacent character pairs (e.g. naurto -> naruto, hamtlet -> hamlet, spidr -> spider)
  const chars = [...normalized];
  for (let i = 0; i < chars.length - 1; i++) {
    const swapped = [...chars];
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    candidates.add(swapped.join(""));
  }

  // 2. High-precision n/m swaps (e.g. hamlet <-> hamnet)
  if (normalized.includes("m")) candidates.add(normalized.replace(/m/g, "n"));
  if (normalized.includes("n")) candidates.add(normalized.replace(/n/g, "m"));

  // 3. Multi-word extractions
  const words = normalized.split(" ").filter(Boolean);
  if (words.length > 1) {
    for (let i = 0; i < words.length; i++) {
      if (words[i].length >= 3) candidates.add(words[i]);
      const without = [...words]; without.splice(i, 1);
      if (without.length > 0) candidates.add(without.join(" "));
    }
  }

  return [...candidates].filter(v => v.length >= 3 && v !== normalized).slice(0, 8);
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
    const normCandidate = normalize(candidate);
    if (!normCandidate || normCandidate === normalizedQuery) continue;
    const dist = editDistance(normalizedQuery, normCandidate);
    if (dist <= maxDistance && (!best || dist < best.distance)) {
      best = { suggestion: candidate, distance: dist };
    }
  }
  return best;
}

export function findCloseTitleMatches(
  query: string,
  candidateTitles: string[],
  maxDistance = 3
): string[] {
  if (!query || !candidateTitles.length) return [];
  const normalizedQuery = normalize(query);
  const matched = new Set<string>();

  for (const candidate of candidateTitles) {
    const normCandidate = normalize(candidate);
    if (!normCandidate) continue;
    if (normCandidate === normalizedQuery) continue;

    const dist = editDistance(normalizedQuery, normCandidate);
    if (dist <= maxDistance) {
      matched.add(candidate);
    } else if (normCandidate.startsWith(normalizedQuery) || normalizedQuery.startsWith(normCandidate)) {
      matched.add(candidate);
    } else {
      const overlap = computeWordOverlap(normalizedQuery, normCandidate);
      if (overlap >= 0.5) {
        matched.add(candidate);
      }
    }
  }

  return [...matched].slice(0, 10);
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
