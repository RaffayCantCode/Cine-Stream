import { Link } from "wouter";
import { Play, Info, Star } from "lucide-react";
import { MediaItem } from "@workspace/api-client-react";
import { motion } from "framer-motion";

export function HeroBanner({ item }: { item: MediaItem }) {
  if (!item) return null;

  const backdropUrl = item.backdrop_path
    ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
    : "";

  const isMovie = item.media_type === "movie" || !!item.title;
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const link = isMovie ? `/movie/${item.id}` : `/tv/${item.id}`;
  const watchLink = isMovie
    ? `/watch/movie/${item.id}`
    : `/watch/tv/${item.id}/1/1`;

  return (
    <div className="relative w-full h-[75vh] md:h-[90vh] flex items-end overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 z-0">
        {backdropUrl ? (
          <motion.img
            src={backdropUrl}
            alt={title}
            className="w-full h-full object-cover object-top scale-105"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1.02 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
          />
        ) : (
          <div className="w-full h-full bg-muted" />
        )}

        {/* Gradient layers */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/20 to-transparent" />
        {/* Top fade */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-background/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 pb-16 md:pb-24 px-5 md:px-10 max-w-3xl">
        {/* Type badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex items-center gap-3 mb-4"
        >
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-primary px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
            {isMovie ? "Movie" : "TV Series"}
          </span>
          {year && (
            <span className="text-xs font-semibold text-white/40 tracking-widest">{year}</span>
          )}
          {item.vote_average ? (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
              <Star className="w-3 h-3 fill-current" />
              {item.vote_average.toFixed(1)}
            </span>
          ) : null}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="font-display text-6xl md:text-8xl text-white leading-none mb-4 tracking-wider text-glow-primary"
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="text-white/65 text-base md:text-lg leading-relaxed line-clamp-3 mb-8 max-w-xl font-medium"
        >
          {item.overview}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.5 }}
          className="flex items-center gap-3 flex-wrap"
        >
          <a
            href={watchLink}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2.5 bg-primary hover:bg-primary/85 active:scale-95 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all duration-200 shadow-lg shadow-primary/30"
            data-testid="hero-btn-watch"
          >
            <span className="relative w-5 h-5">
              <Play className="w-5 h-5 fill-current absolute inset-0 group-hover:scale-110 transition-transform" />
            </span>
            Watch Now
          </a>

          <Link
            href={link}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/15 active:scale-95 border border-white/10 text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-all duration-200 backdrop-blur-sm"
            data-testid="hero-btn-info"
          >
            <Info className="w-4 h-4" />
            More Info
          </Link>
        </motion.div>
      </div>

      {/* Bottom vignette */}
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-20" />
    </div>
  );
}
