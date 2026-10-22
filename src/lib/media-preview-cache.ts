/**
 * Tiny store for the card data the user just clicked.
 *
 * Detail pages are server-rendered, so nothing can paint until their TMDB
 * request finishes. While that request is in flight the route's `loading.tsx`
 * uses this preview to render the real title/backdrop immediately, which makes
 * the page feel like it opened instantly instead of waiting behind a loader.
 */

export type PreviewMediaType = "movie" | "tv";

export interface MediaPreview {
  id: string;
  mediaType: PreviewMediaType;
  title: string;
  overview: string;
  backdropPath: string | null;
  posterPath: string | null;
  voteAverage: number | null;
  releaseDate: string | null;
}

const KEY_PREFIX = "cinestream_media_preview_";
const MAX_AGE_MS = 30 * 60 * 1000;

function previewKey(mediaType: PreviewMediaType, id: string): string {
  return `${KEY_PREFIX}${mediaType}_${id}`;
}

export function cacheMediaPreview(
  item: {
    id?: number | string;
    title?: string;
    name?: string;
    overview?: string;
    backdrop_path?: string | null;
    poster_path?: string | null;
    vote_average?: number;
    release_date?: string;
    first_air_date?: string;
  },
  mediaType: PreviewMediaType
): void {
  if (typeof window === "undefined" || item?.id === undefined || item?.id === null) {
    return;
  }

  try {
    const preview: MediaPreview = {
      id: String(item.id),
      mediaType,
      title: item.title || item.name || "",
      overview: item.overview || "",
      backdropPath: item.backdrop_path || null,
      posterPath: item.poster_path || null,
      voteAverage:
        typeof item.vote_average === "number" ? item.vote_average : null,
      releaseDate: item.release_date || item.first_air_date || null,
    };
    window.sessionStorage.setItem(
      previewKey(mediaType, preview.id),
      JSON.stringify({ preview, at: Date.now() })
    );
  } catch {}
}

export function getMediaPreview(
  mediaType: PreviewMediaType,
  id: string | number
): MediaPreview | null {
  if (typeof window === "undefined" || !id) return null;

  try {
    const raw = window.sessionStorage.getItem(previewKey(mediaType, String(id)));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { preview?: MediaPreview; at?: number };
    if (
      !parsed?.preview ||
      typeof parsed.at !== "number" ||
      Date.now() - parsed.at > MAX_AGE_MS
    ) {
      return null;
    }
    return parsed.preview;
  } catch {
    return null;
  }
}
