export interface AnimeEmbedSource {
  name: string;
  embedUrl: string;
  type: "iframe";
  quality: "HD";
}

function cleanAnimeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function getAllAnimeSources(title: string, episode: number = 1): AnimeEmbedSource[] {
  const clean = cleanAnimeTitle(title);

  return [
    {
      name: "2Anime",
      embedUrl: `https://2anime.xyz/embed/${clean}-episode-${episode}`,
      type: "iframe",
      quality: "HD",
    },
    {
      name: "VidAPI",
      embedUrl: `https://vidapi.xyz/embed/anime/${clean}-episode-${episode}`,
      type: "iframe",
      quality: "HD",
    },
  ];
}

export function getPrimaryAnimeEmbed(title: string, episode: number = 1): AnimeEmbedSource {
  return getAllAnimeSources(title, episode)[0];
}

export function getAnimeEmbedSources(animeId: string, episode: number = 1): AnimeEmbedSource[] {
  const decoded = decodeURIComponent(animeId);
  return getAllAnimeSources(decoded, episode);
}

export function getAutoEmbedSources(title: string, episode: number = 1): AnimeEmbedSource[] {
  return getAllAnimeSources(title, episode);
}
