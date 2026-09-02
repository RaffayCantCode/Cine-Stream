"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { X, Search, Download, Subtitles, Loader2, Check, AlertCircle, Globe, Star } from "lucide-react";

const LANGUAGE_OPTIONS = [
  { code: "en", name: "English" },
  { code: "ar", name: "Arabic" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "hi", name: "Hindi" },
  { code: "id", name: "Indonesian" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ms", name: "Malay" },
  { code: "pt-BR", name: "Portuguese (BR)" },
  { code: "ru", name: "Russian" },
  { code: "es", name: "Spanish" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
];

export interface OpenSubtitle {
  id: string;
  lang: string;
  langName: string;
  label: string;
  downloadUrl: string | null;
  fileId: number;
  downloadCount: number;
  isHearingImpaired: boolean;
  isTrusted: boolean;
}

export interface SubtitleCueItem {
  start: number;
  end: number;
  text: string;
}

interface OpenSubtitlesPickerProps {
  isOpen: boolean;
  onClose: () => void;
  tmdbId?: number | string | null;
  season?: number;
  episode?: number;
  /** Called with the resolved .vtt URL, a human-readable label, and optional parsed cues */
  onSelectSubtitle: (url: string, label: string, cues?: SubtitleCueItem[]) => void;
}

type LoadState = "idle" | "loading" | "done" | "error" | "no-key";

export const OpenSubtitlesPicker = memo(function OpenSubtitlesPicker({
  isOpen,
  onClose,
  tmdbId,
  season,
  episode,
  onSelectSubtitle,
}: OpenSubtitlesPickerProps) {
  const [selectedLang, setSelectedLang] = useState("en");
  const [subtitles, setSubtitles] = useState<OpenSubtitle[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedId, setDownloadedId] = useState<string | null>(null);

  const search = useCallback(async (lang: string) => {
    setLoadState("loading");
    setSubtitles([]);
    setErrorMsg(null);

    try {
      const params = new URLSearchParams({ langs: lang });
      if (tmdbId) params.set("tmdbId", String(tmdbId));
      if (season) params.set("season", String(season));
      if (episode) params.set("episode", String(episode));

      const res = await fetch(`/api/subtitles/search?${params.toString()}`);
      const data = await res.json();

      if (data?.error?.includes("API key")) {
        setLoadState("no-key");
        return;
      }

      if (!res.ok || data?.error) {
        setErrorMsg(data?.error || "Search failed");
        setLoadState("error");
        return;
      }

      setSubtitles(data.subtitles || []);
      setLoadState("done");
    } catch {
      setErrorMsg("Network error — please try again");
      setLoadState("error");
    }
  }, [tmdbId, season, episode]);

  // Auto-search when opened
  useEffect(() => {
    if (isOpen && tmdbId) {
      search(selectedLang);
    }
  }, [isOpen, tmdbId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLanguageChange = (lang: string) => {
    setSelectedLang(lang);
    search(lang);
  };

  const handleSelect = async (sub: OpenSubtitle) => {
    setDownloadingId(sub.id);
    try {
      const res = await fetch("/api/subtitles/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: sub.fileId }),
      });
      const data = await res.json();

      if (data?.link || (data?.cues && data.cues.length > 0) || data?.vtt) {
        setDownloadedId(sub.id);
        let finalUrl = data?.link || "";
        if (data?.vtt && typeof window !== "undefined") {
          try {
            const blob = new Blob([data.vtt], { type: "text/vtt" });
            finalUrl = URL.createObjectURL(blob);
          } catch {}
        }
        onSelectSubtitle(finalUrl, sub.label || `${sub.langName} Subtitle`, data?.cues || []);
        setTimeout(() => onClose(), 800);
      } else {
        setErrorMsg(data?.error || "Could not get subtitle download link");
      }
    } catch {
      setErrorMsg("Download failed — please try again");
    } finally {
      setDownloadingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-fade-in">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-gradient-to-b from-zinc-900 to-black border border-white/15 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.98)] z-10 flex flex-col max-h-[85vh] overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Subtitles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">OpenSubtitles</h3>
              <p className="text-[11px] text-white/50">Community subtitles in any language</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Language Selector ── */}
        <div className="px-6 py-4 border-b border-white/[0.07] shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-3.5 h-3.5 text-white/50" />
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">Language</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((l) => (
              <button
                key={l.code}
                onClick={() => handleLanguageChange(l.code)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                  selectedLang === l.code
                    ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 shadow"
                    : "bg-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.12] border border-transparent"
                }`}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── Subtitle Results ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">

          {/* No API Key */}
          {loadState === "no-key" && (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">API Key Required</p>
                <p className="text-xs text-white/50 max-w-xs">
                  Add your free OpenSubtitles API key to <code className="text-amber-300 font-mono">.env.local</code>:
                </p>
                <code className="block text-xs text-emerald-400 font-mono bg-white/5 px-3 py-2 rounded-xl mt-2">
                  OPENSUBTITLES_API_KEY=your_key_here
                </code>
                <a
                  href="https://www.opensubtitles.com/en/consumers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                >
                  Get a free API key →
                </a>
              </div>
            </div>
          )}

          {/* Loading */}
          {loadState === "loading" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-xs text-white/50">Searching OpenSubtitles...</p>
            </div>
          )}

          {/* Error */}
          {loadState === "error" && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400" />
              <p className="text-xs text-rose-300">{errorMsg}</p>
              <button
                onClick={() => search(selectedLang)}
                className="px-4 py-2 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty results */}
          {loadState === "done" && subtitles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
              <Search className="w-7 h-7 text-white/30" />
              <p className="text-xs text-white/40">No subtitles found for this language.</p>
              <p className="text-[11px] text-white/30">Try English or another language.</p>
            </div>
          )}

          {/* Subtitle List */}
          {loadState === "done" && subtitles.length > 0 && (
            <>
              <p className="text-[11px] text-white/40 pb-1">{subtitles.length} results found</p>
              {subtitles.map((sub) => {
                const isDownloading = downloadingId === sub.id;
                const isDone = downloadedId === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => !isDownloading && !isDone && handleSelect(sub)}
                    disabled={isDownloading}
                    className={`w-full text-left flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer group ${
                      isDone
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.10] hover:border-white/20 text-white"
                    }`}
                  >
                    {/* Left: Status Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isDone
                        ? "bg-emerald-500/30"
                        : isDownloading
                        ? "bg-white/10"
                        : "bg-white/[0.06] group-hover:bg-white/[0.12]"
                    }`}>
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white/70" />
                      ) : isDone ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Download className="w-4 h-4 text-white/50 group-hover:text-white" />
                      )}
                    </div>

                    {/* Middle: Subtitle Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold truncate max-w-[240px]">
                          {sub.label || `${sub.langName} Subtitle`}
                        </span>
                        {sub.isTrusted && (
                          <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md shrink-0">
                            Trusted
                          </span>
                        )}
                        {sub.isHearingImpaired && (
                          <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-md shrink-0">
                            HI
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-white/40">
                          {sub.langName}
                        </span>
                        {sub.downloadCount > 0 && (
                          <span className="text-[10px] text-white/30">
                            • {sub.downloadCount.toLocaleString()} downloads
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Language Badge */}
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-1 bg-white/10 text-white/60 rounded-lg shrink-0">
                      {sub.lang.toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-white/[0.07] shrink-0 flex items-center justify-between gap-3">
          <p className="text-[10px] text-white/30">
            Powered by{" "}
            <a
              href="https://www.opensubtitles.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/50 hover:text-white underline underline-offset-2"
            >
              OpenSubtitles.com
            </a>
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
});
