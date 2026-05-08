const TMDB_BASE = "https://api.themoviedb.org/3";

function getAuthHeader(): string {
  const token = process.env.TMDB_API_KEY;
  if (!token) throw new Error("TMDB_API_KEY environment variable is not set");
  return `Bearer ${token}`;
}

export async function tmdbFetch(
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${TMDB_BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`TMDB fetch failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
