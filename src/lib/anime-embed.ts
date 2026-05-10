// Anime Embed Sources - Using title-based search URLs
// These work by searching anime by title in the URL

export interface AnimeEmbedSource {
  name: string;
  embedUrl: string;
  type: "iframe";
  quality: "HD";
}

// Clean title for URL
function cleanAnimeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// Get all anime sources from title
export function getAllAnimeSources(title: string, episode: number = 1): AnimeEmbedSource[] {
  const clean = cleanAnimeTitle(title);
  
  return [
    {
      name: "2Embed",
      embedUrl: `https://www.2embed.cc/embed/${clean}-episode-${episode}`,
      type: "iframe",
      quality: "HD",
    },
    {
      name: "VidKing",
      embedUrl: `https://www.vidking.net/embed/tv/${clean}/${episode}`,
      type: "iframe",
      quality: "HD",
    },
    {
      name: "VidSrc",
      embedUrl: `https://vidsrc-embed.ru/embed/tv/${clean}/${episode}`,
      type: "iframe",
      quality: "HD",
    },
    {
      name: "VidSrc.in",
      embedUrl: `https://vidsrc.in/embed/tv/${clean}/${episode}`,
      type: "iframe",
      quality: "HD",
    },
  ];
}

// Get primary source
export function getPrimaryAnimeEmbed(title: string, episode: number = 1): AnimeEmbedSource {
  return getAllAnimeSources(title, episode)[0];
}

// Legacy compatibility - handle animeId as second param
export function getAnimeEmbedSources(animeId: string, episode: number = 1): AnimeEmbedSource[] {
  const decoded = decodeURIComponent(animeId);
  return getAllAnimeSources(decoded, episode);
}

export function getAutoEmbedSources(title: string, episode: number = 1): AnimeEmbedSource[] {
  return getAllAnimeSources(title, episode);
}