// Multi-API Streaming Fetcher with Fallback Logic
// APIs included:
// 1. AutoEmbed - https://autoembed.co (Most reliable - Updated 2024)
// 2. 2Embed - https://www.2embed.cc
// 3. VidSrc XYZ - https://vidsrc.xyz (Working domain)
// 4. SuperEmbed - https://superembed.stream
// 5. VidKing - https://www.vidking.net
// 6. MoviesAPI - https://moviesapi.club

interface StreamingAPIConfig {
  name: string;
  baseUrl: string;
  type: "autoembed" | "2embed" | "vidsrc" | "superembed" | "vidking" | "moviesapi";
}

const STREAMING_APIS: StreamingAPIConfig[] = [
  {
    name: "AutoEmbed",
    baseUrl: "https://autoembed.co",
    type: "autoembed",
  },
  {
    name: "2Embed",
    baseUrl: "https://www.2embed.cc",
    type: "2embed",
  },
  {
    name: "VidSrc",
    baseUrl: "https://vidsrc.xyz",
    type: "vidsrc",
  },
  {
    name: "SuperEmbed",
    baseUrl: "https://superembed.stream",
    type: "superembed",
  },
  {
    name: "VidKing",
    baseUrl: "https://www.vidking.net",
    type: "vidking",
  },
  {
    name: "MoviesAPI",
    baseUrl: "https://moviesapi.club",
    type: "moviesapi",
  },
];

// Build embed URL based on API type
function buildEmbedUrl(api: StreamingAPIConfig, type: "movie" | "tv", id: number, season?: number, episode?: number): string {
  switch (api.type) {
    case "autoembed":
      // AutoEmbed uses TMDB ID directly - most reliable
      if (type === "movie") {
        return `${api.baseUrl}/movie/${id}`;
      }
      return `${api.baseUrl}/tv/${id}/${season ?? 1}/${episode ?? 1}`;
    
    case "vidsrc":
      if (type === "movie") {
        return `${api.baseUrl}/embed/movie/${id}`;
      }
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;
    
    case "2embed":
      if (type === "movie") {
        return `${api.baseUrl}/embed/${id}`;
      }
      return `${api.baseUrl}/embedtv/${id}/${season ?? 1}/${episode ?? 1}`;
    
    case "superembed":
      if (type === "movie") {
        return `${api.baseUrl}/embed/movie/${id}`;
      }
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;
    
    case "vidking":
      if (type === "movie") {
        return `${api.baseUrl}/embed/movie/${id}`;
      }
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;
    
    case "moviesapi":
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
