// Content filter to block adult/sexual content

const ADULT_GENRES = [
  "hentai",
  "ecchi",
  "erotica",
  "pornographic",
  "boys love",
  "girls love",
  "shotacon",
  "yaoi",
  "yuri",
  "smut",
  "adult",
  "sexual",
  "mature",
  "nude",
  "nudity",
  "bare",
  "explicit",
];

const ADULT_KEYWORDS = [
  "hentai",
  "ecchi",
  "nude",
  "naked",
  "porn",
  "sex",
  "erotic",
  "18+",
  "adult",
  "xxx",
  "lingerie",
  "bikini",
  "underwear",
  "sexual",
  "nsfw",
  "explicit",
  "mature",
  "smut",
  "doujinshi",
  "yaoi",
  "yuri",
  "shotacon",
  "futanari",
  "milf",
  "lolicon",
  "shota",
];

export function isAdultContent(
  name?: string,
  genres?: string[],
  description?: string,
  rating?: string | null
): boolean {
  const lowerName = (name || "").toLowerCase();
  const lowerGenres = (genres || []).map((g) => g.toLowerCase());
  const lowerDesc = (description || "").toLowerCase();
  const lowerRating = (rating || "").toLowerCase();

  // Check rating first
  if (
    lowerRating.includes("rx") ||
    lowerRating.includes("r18") ||
    lowerRating.includes("r+") ||
    lowerRating.includes("nc17") ||
    lowerRating.includes("xxx")
  ) {
    return true;
  }

  // Check genres
  for (const genre of lowerGenres) {
    if (ADULT_GENRES.some((ag) => genre.includes(ag))) {
      return true;
    }
  }

  // Check name for adult keywords
  for (const keyword of ADULT_KEYWORDS) {
    if (lowerName.includes(keyword)) {
      return true;
    }
  }

  // Check description for adult keywords
  let keywordMatches = 0;
  for (const keyword of ADULT_KEYWORDS) {
    if (lowerDesc.includes(keyword)) {
      keywordMatches++;
    }
  }
  // If more than 2 adult keywords in description, likely adult content
  if (keywordMatches >= 2) {
    return true;
  }

  return false;
}

export function filterAdultContent<T extends { name?: string; genres?: string[]; description?: string }>(
  items: T[]
): T[] {
  return items.filter((item) => !isAdultContent(item.name, item.genres, item.description));
}