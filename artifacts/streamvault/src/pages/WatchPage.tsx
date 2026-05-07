import { useParams, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export function WatchMovie() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = params.id;

  return (
    <div className="fixed inset-0 bg-black z-[9999] flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 bg-black/80 backdrop-blur-sm shrink-0">
        <button
          onClick={() => navigate(`/movie/${id}`)}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-medium"
          data-testid="btn-back-movie"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>
      <div className="flex-1 relative">
        <iframe
          src={`https://www.vidking.net/embed/movie/${id}?autoPlay=true`}
          className="absolute inset-0 w-full h-full border-0"
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write"
          referrerPolicy="no-referrer"
          title="Movie Player"
        />
      </div>
    </div>
  );
}

export function WatchTv() {
  const params = useParams<{ id: string; season: string; episode: string }>();
  const [, navigate] = useLocation();
  const { id, season, episode } = params;

  return (
    <div className="fixed inset-0 bg-black z-[9999] flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 bg-black/80 backdrop-blur-sm shrink-0">
        <button
          onClick={() => navigate(`/tv/${id}`)}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-medium"
          data-testid="btn-back-tv"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span className="text-white/40 text-sm">S{season} · E{episode}</span>
      </div>
      <div className="flex-1 relative">
        <iframe
          src={`https://www.vidking.net/embed/tv/${id}/${season}/${episode}?autoPlay=true&nextEpisode=true&episodeSelector=true`}
          className="absolute inset-0 w-full h-full border-0"
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write"
          referrerPolicy="no-referrer"
          title="TV Player"
        />
      </div>
    </div>
  );
}
