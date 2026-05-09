// List of known public instances of the HiAnime/Aniwatch API
// These scrape the anime site and often get blocked or rate-limited,
// so we try multiple instances for high availability.
const ANIME_API_INSTANCES = [
  "https://aniwatch-api-net.vercel.app/api/v2/hianime",
  "https://hianime-api.vercel.app/api/v2/hianime",
  "https://aniwatch-api-v2.vercel.app/api/v2/hianime",
];

export async function fetchAnimeApi(endpoint: string, options?: RequestInit) {
  let lastError: Error | null = null;

  for (const baseUrl of ANIME_API_INSTANCES) {
    try {
      const url = `${baseUrl}${endpoint}`;
      const res = await fetch(url, {
        ...options,
        headers: {
          Accept: "application/json",
          "User-Agent": "StreamVault/1.0",
          ...options?.headers,
        },
      });

      if (!res.ok) {
        throw new Error(`Instance ${baseUrl} returned ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      return data;
    } catch (error) {
      console.warn(`[Anime API Fallback] Failed fetching from ${baseUrl}:`, error instanceof Error ? error.message : "Unknown error");
      lastError = error instanceof Error ? error : new Error(String(error));
      continue; // Try the next instance
    }
  }

  // If all instances fail, throw the last error
  throw lastError || new Error("All Anime API instances failed");
}
