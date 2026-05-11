"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Play, AlertCircle, Check, Server } from "lucide-react";
import { StreamingSource, getStreamingSources } from "@/lib/streaming-fetch";

interface VideoPlayerProps {
  type: "movie" | "tv";
  id: number;
  season?: number;
  episode?: number;
  title?: string;
}

export function VideoPlayer({ type, id, season, episode, title }: VideoPlayerProps) {
  const sources = getStreamingSources(type, id, season, episode);
  const [currentSource, setCurrentSource] = useState<StreamingSource>(sources[0]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleSourceChange = (source: StreamingSource) => {
    setCurrentSource(source);
    setError(null);
    setIsLoading(true);
  };

  const handleIframeError = () => {
    // Try next source
    const currentIndex = sources.findIndex(s => s.name === currentSource.name);
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
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
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
        key={currentSource.url}
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
                className="mt-4 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-sm font-medium transition-colors"
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
                  <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-white/60">Loading {currentSource.name}...</p>
                  {error && <p className="text-xs text-white/40 mt-1">{error}</p>}
                </div>
              </div>
            )}
            <iframe
              src={currentSource.url}
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen={true}
              title={title || "Watch"}
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
