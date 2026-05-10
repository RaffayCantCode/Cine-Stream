// Reliable Anime Embed Sources
// These provide iframe-based players that are more stable than API-based streaming
// All sources support Japanese audio with English subtitles

export interface AnimeEmbedSource {
  name: string;
  embedUrl: string;
  type: "iframe";
  quality: "HD" | "SD";
  requiresReferrer?: boolean;
  hasSubtitles?: boolean;
  hasDub?: boolean;
}

// Build embed URLs for popular anime embed services
// All sources verified to have Japanese audio + English subtitles
export function getAnimeEmbedSources(animeId: string, episode: number = 1): AnimeEmbedSource[] {
  // Sanitize anime ID for use in URLs
  const sanitizedId = animeId.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  
  return [
    {
      name: "AniWatch TV",
      embedUrl: `https://aniwatchtv.to/watch/${sanitizedId}/${episode}`,
      type: "iframe",
      quality: "HD",
      requiresReferrer: false,
      hasSubtitles: true,
      hasDub: true,
    },
    {
      name: "HiAnime",
      embedUrl: `https://hianime.to/watch/${sanitizedId}/${episode}`,
      type: "iframe",
      quality: "HD",
      requiresReferrer: false,
      hasSubtitles: true,
      hasDub: true,
    },
    {
      name: "AniWave",
      embedUrl: `https://aniwave.to/watch/${sanitizedId}/ep-${episode}`,
      type: "iframe",
      quality: "HD",
      requiresReferrer: false,
      hasSubtitles: true,
      hasDub: true,
    },
    {
      name: "GogoAnime",
      embedUrl: `https://gogoanime3.co/${sanitizedId}-episode-${episode}`,
      type: "iframe",
      quality: "HD",
      requiresReferrer: true,
      hasSubtitles: true,
      hasDub: true,
    },
    {
      name: "9Anime",
      embedUrl: `https://9anime.to/watch/${sanitizedId}/${episode}`,
      type: "iframe",
      quality: "HD",
      requiresReferrer: false,
      hasSubtitles: true,
      hasDub: true,
    },
  ];
}

// Alternative: Use auto-embed services that search and embed automatically
// These work with anime titles directly and provide Japanese dub + English subs
export function getAutoEmbedSources(title: string, episode: number = 1): AnimeEmbedSource[] {
  const encodedTitle = encodeURIComponent(title);
  
  return [
    {
      name: "AutoEmbed Anime",
      embedUrl: `https://autoembed.co/anime/${encodedTitle}/${episode}`,
      type: "iframe",
      quality: "HD",
      requiresReferrer: false,
      hasSubtitles: true,
      hasDub: false,
    },
    {
      name: "VidSrc.me Anime",
      embedUrl: `https://vidsrcme.ru/embed/anime/${encodedTitle}/${episode}`,
      type: "iframe",
      quality: "HD",
      requiresReferrer: false,
      hasSubtitles: true,
      hasDub: false,
    },
    {
      name: "2Embed Anime",
      embedUrl: `https://www.2embed.cc/anime/${encodedTitle}/${episode}`,
      type: "iframe",
      quality: "HD",
      requiresReferrer: false,
      hasSubtitles: true,
      hasDub: false,
    },
    {
      name: "VidSrc.sbs Anime",
      embedUrl: `https://vidsrc.sbs/embed/anime/${encodedTitle}/${episode}`,
      type: "iframe",
      quality: "HD",
      requiresReferrer: false,
      hasSubtitles: true,
      hasDub: false,
    },
  ];
}

// Get primary source (first one)
export function getPrimaryAnimeEmbed(title: string, animeId: string, episode: number = 1): AnimeEmbedSource {
  const sources = getAnimeEmbedSources(animeId, episode);
  const autoSources = getAutoEmbedSources(title, episode);
  return autoSources[0] || sources[0];
}

// Get all sources combined
export function getAllAnimeSources(title: string, animeId: string, episode: number = 1): AnimeEmbedSource[] {
  return [...getAutoEmbedSources(title, episode), ...getAnimeEmbedSources(animeId, episode)];
}
