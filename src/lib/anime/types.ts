// Shared types for the anime subsystem.
// Canonical identity is the AniList ID (string). All consumers (server, API
// routes, client UI, browse cards) import these from one place.

export interface AnimeEpisodeCounts {
  sub: number | null;
  dub: number | null;
}

export interface NextAiringEpisode {
  episode: number;
  airingAt: number;
  timeUntilAiring: number;
}

/** Browse/search card item (used by AnimeCard, rows, browse pages). */
export interface AnimeItem {
  id: string;
  idMal?: string | null;
  isAdult?: boolean;
  name: string;
  jname?: string | null;
  poster: string;
  type?: string | null;
  episodes?: AnimeEpisodeCounts;
  rating?: string | null;
  description?: string;
  genres?: string[];
  status?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  format?: string | null;
  duration?: number | null;
  trailerId?: string | null;
  nextAiringEpisode?: NextAiringEpisode | null;
  reason?: string;
}

/** A season / franchise entry that appears in the season guide. */
export interface SeasonInfo {
  id: string;
  name: string;
  seasonLabel: string;
  totalEpisodes: number;
  isCurrent: boolean;
  idMal?: number | null;
  seasonYear?: number | null;
  status?: string | null;
  format?: string | null;
  tmdbId?: number | null;
  tmdbSeasonNumber?: number | null;
  episodeOffset?: number;
  coverImage?: string | null;
  bannerImage?: string | null;
}

/** A single episode. */
export interface EpisodeDetail {
  episodeId: string;
  episodeNum: number;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  releasedDate?: string | null;
  isFiller?: boolean;
  isRecap?: boolean;
  isReleased?: boolean;
  isUpcoming?: boolean;
  malUrl?: string | null;
  seasonNum?: number;
  seasonId?: string;
  seasonName?: string;
  seasonMalId?: number | null;
  runtime?: number | null;
  vote_average?: number;
  vote_count?: number;
  tmdbSeasonNumber?: number;
  tmdbEpisodeNumber?: number;
}

/** Canonical core metadata resolved from AniList. */
export interface AnimeCore {
  id: string;
  idMal: string | null;
  name: string;
  jname: string | null;
  poster: string;
  bannerImage: string | null;
  description: string;
  type: string | null;
  rating: string | null;
  status: string | null;
  genres: string[];
  totalEpisodes: number | null;
  season: string | null;
  seasonYear: number | null;
  format: string | null;
  duration: number | null;
  trailerId: string | null;
  nextAiringEpisode: NextAiringEpisode | null;
}

/** A node in the franchise / watch-order graph. */
export interface FranchiseNode {
  id: number;
  idMal: number | null;
  title: string;
  episodes: number | null;
  season: string | null;
  seasonYear: number | null;
  status?: string | null;
  format: string | null;
  duration: number | null;
  coverImage?: string | null;
  bannerImage?: string | null;
  tmdbId?: number | null;
  tmdbSeasonNumber?: number | null;
  episodeOffset?: number;
  seasonLabel?: string | null;
}

/** Complete deterministic catalog for one anime entry. */
export interface AnimeCatalog {
  anime: AnimeCore;
  seasons: SeasonInfo[];
  openedSeasonId: string;
  franchiseNodes: FranchiseNode[];
  tmdbId: number | null;
  tmdbSeasonMap: Record<string, number>;
}
