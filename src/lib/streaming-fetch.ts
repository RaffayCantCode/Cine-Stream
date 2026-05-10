// Multi-API Streaming Fetcher with Fallback Logic
// APIs included:
// 1. VidSrc.me - https://vidsrcme.ru (Working - Recommended)
// 2. VidSrc.sbs - https://vidsrc.sbs (Working)
// 3. 2Embed - https://www.2embed.cc (Working)
// 4. VidKing - https://www.vidking.net (Working)
// 5. VidSrc.icu - https://vidsrc.icu (Working alternative)
// 6. AutoEmbed - https://autoembed.co (Backup)

interface StreamingAPIConfig {
  name: string;
  baseUrl: string;
  type: "vidsrcme" | "vidsrcsbs" | "2embed" | "vidking" | "vidsrcicu" | "autoembed";
}

const STREAMING_APIS: StreamingAPIConfig[] = [
  {
    name: "VidSrc.me",
    baseUrl: "https://vidsrcme.ru",
    type: "vidsrcme",
  },
  {
    name: "VidSrc.sbs",
    baseUrl: "https://vidsrc.sbs",
    type: "vidsrcsbs",
  },
  {
    name: "2Embed",
    baseUrl: "https://www.2embed.cc",
    type: "2embed",
  },
  {
    name: "VidKing",
    baseUrl: "https://www.vidking.net",
    type: "vidking",
  },
  {
    name: "VidSrc.icu",
    baseUrl: "https://vidsrc.icu",
    type: "vidsrcicu",
  },
  {
    name: "AutoEmbed",
    baseUrl: "https://autoembed.co",
    type: "autoembed",
  },
];

// Build embed URL based on API type
function buildEmbedUrl(api: StreamingAPIConfig, type: "movie" | "tv", id: number, season?: number, episode?: number): string {
  switch (api.type) {
    case "vidsrcme":
      // vidsrcme.ru uses embed/tt{id} format
      if (type === "movie") {
        return `${api.baseUrl}/embed/movie/${id}`;
      }
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;
    
    case "vidsrcsbs":
      // vidsrc.sbs uses embed/movie/{tmdb_id} format
      if (type === "movie") {
        return `${api.baseUrl}/embed/movie/${id}`;
      }
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;
    
    case "2embed":
      if (type === "movie") {
        return `${api.baseUrl}/embed/${id}`;
      }
      return `${api.baseUrl}/embedtv/${id}/${season ?? 1}/${episode ?? 1}`;
    
    case "vidking":
      if (type === "movie") {
        return `${api.baseUrl}/embed/movie/${id}`;
      }
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;
    
    case "vidsrcicu":
      // vidsrc.icu uses /movie/{tmdb_id} format
      if (type === "movie") {
        return `${api.baseUrl}/movie/${id}`;
      }
      return `${api.baseUrl}/tv/${id}`;
    
    case "autoembed":
      // AutoEmbed uses TMDB ID directly
      if (type === "movie") {
        return `${api.baseUrl}/movie/${id}`;
      }
      return `${api.baseUrl}/tv/${id}/${season ?? 1}/${episode ?? 1}`;
    
    default:
      return "";
  }
}

export interface StreamingSource {
  url: string;
  name: string;
  type: string;
}

// Get streaming sources with fallback
export function getStreamingSources(type: "movie" | "tv", id: number, season?: number, episode?: number): StreamingSource[] {
  return STREAMING_APIS.map(api => ({
    url: buildEmbedUrl(api, type, id, season, episode),
    name: api.name,
    type: api.type,
  }));
}

// Get primary source (first one)
export function getPrimarySource(type: "movie" | "tv", id: number, season?: number, episode?: number): StreamingSource {
  const sources = getStreamingSources(type, id, season, episode);
  return sources[0];
}
