"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Check, Server } from "lucide-react";
import { AnimeEmbedSource, getAllAnimeSources } from "@/lib/anime-embed";

interface AnimePlayerProps {
  animeId: string;
  animeTitle: string;
  episode: number;
}

export function AnimePlayer({ animeId, animeTitle, episode }: AnimePlayerProps) {
  const sources = getAllAnimeSources(animeTitle, animeId, episode);
  const [currentSource, setCurrentSource] = useState<AnimeEmbedSource>(sources[0]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleSourceChange = (source: AnimeEmbedSource) => {
    setCurrentSource(source);
    setError(null);
    setIsLoading(true);
  };

  const handleIframeError = () => {
    // Try next source
    const currentIndex = sources.findIndex((s) => s.name === currentSource.name);
    const nextSource = sources[currentIndex + 1];

    if (nextSource) {
      setError(`${currentSource.name} failed, trying ${nextSource.name}...`);
      setTimeout(() => {
        setCurrentSource(nextSource);
        setError(null);
      }, 2000);
    } else {
      setError("All streaming sources failed. Please try again later.");
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Source Selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-white/50 font-medium uppercase tracking-wider">Source:</span>
        {sources.map((source) => (
          <button
            key={source.name}
            onClick={() => handleSourceChange(source)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
              currentSource.name === source.name
                ? "bg-violet-600 text-white shadow-md shadow-violet-500/30"
                : "bg-white/[0.05] text-white/60 hover:bg-white/[0.09] hover:text-white"
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            {source.name}
            {currentSource.name === source.name && isLoading && (
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {currentSource.name === source.name && !isLoading && !error && (
              <Check className="w-3.5 h-3.5" />
            )}
          </button>
        ))}
      </div>

      {/* Video Player */}
      <motion.div
        key={currentSource.embedUrl}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black ring-1 ring-white/10 relative"
      >
        {error && !error.includes("trying") ? (
          <div className="w-full h-full flex items-center justify-center text-white/60">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <p className="text-sm">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setCurrentSource(sources[0]);
                }}
                className="mt-4 px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 rounded-lg text-sm font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-white/60">Loading {currentSource.name}...</p>
                  {error && <p className="text-xs text-white/40 mt-1">{error}</p>}
                </div>
              </div>
            )}
            <iframe
              src={currentSource.embedUrl}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write"
              title={`${animeTitle} - Episode ${episode}`}
              referrerPolicy={currentSource.requiresReferrer ? "origin" : "no-referrer"}
              onLoad={() => setIsLoading(false)}
              onError={handleIframeError}
            />
          </>
        )}
      </motion.div>

      {/* Subtitle Note */}
      <p className="text-xs text-white/40 text-center">
        Subtitles are automatically enabled. Click the CC button in the player to adjust.
      </p>
    </div>
  );
}
