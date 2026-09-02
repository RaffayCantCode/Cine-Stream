"use client";

import { memo } from "react";
import { X, Server, Check, Zap, ShieldCheck, Sparkles, AlertCircle } from "lucide-react";
import { SOURCE_TAG_LABELS, TAG_STYLES, type SourceTag } from "@/lib/streaming-config";

export interface ServerOption {
  key: string;
  name: string;
  type: string;
  quality?: "Best" | "Stable" | "Good" | "Backup" | string;
  tag?: SourceTag | string;
  description?: string;
  isWorking?: boolean;
}

interface ServerSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  servers: ServerOption[];
  activeServerKey: string;
  onSelectServer: (server: ServerOption) => void;
  title?: string;
}

const QUALITY_BADGES: Record<string, string> = {
  Best: "bg-emerald-400/15 text-emerald-300 border-emerald-300/25",
  Stable: "bg-violet-400/15 text-violet-300 border-violet-300/25",
  Good: "bg-cyan-400/15 text-cyan-300 border-cyan-300/25",
  Backup: "bg-amber-400/15 text-amber-300 border-amber-300/25",
};

export const ServerSelectorModal = memo(function ServerSelectorModal({
  isOpen,
  onClose,
  servers,
  activeServerKey,
  onSelectServer,
  title,
}: ServerSelectorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Click outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-gradient-to-b from-zinc-900 to-black border border-white/15 rounded-3xl p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.95)] z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">Stream Servers</h3>
              <p className="text-xs text-white/50">{title ? `Choose source for "${title}"` : "Instant stream switching"}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close server selector"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tip Box */}
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs">
          <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-amber-300 font-bold block mb-0.5">High-Speed Playback:</strong>
            If your video is buffering or lagging, switch to another server. <strong>Server 1 & 2</strong> provide the highest bitrate and multi-subtitles.
          </p>
        </div>

        {/* Server Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
          {servers.map((server, idx) => {
            const isActive = activeServerKey === server.type || activeServerKey === server.key || activeServerKey === server.name;
            const tagKey = server.tag as SourceTag;
            const tagLabel = tagKey && SOURCE_TAG_LABELS[tagKey] ? SOURCE_TAG_LABELS[tagKey] : server.quality || "Server";
            const tagStyle = (tagKey && TAG_STYLES[tagKey]) || (server.quality && QUALITY_BADGES[server.quality]) || "bg-white/10 text-white/80 border-white/15";

            return (
              <button
                key={server.key || server.type || idx}
                onClick={() => {
                  onSelectServer(server);
                  onClose();
                }}
                className={`relative flex items-center justify-between p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-primary/20 border-primary/60 shadow-[0_0_25px_rgba(99,102,241,0.3)] ring-1 ring-primary/40 text-white"
                    : "bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-white/20 text-white/80"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-3 h-3 rounded-full shrink-0 ${
                      isActive ? "bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" : "bg-white/30"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white truncate">{`Source ${idx + 1}`}</span>
                    </div>
                    <span className="text-[11px] text-white/40 block mt-0.5">
                      Fast Stream Server
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${tagStyle}`}>
                    {tagLabel}
                  </span>
                  {isActive && <Check className="w-4 h-4 text-emerald-400" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="pt-2 text-center text-xs text-white/40 border-t border-white/5 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>All servers feature SSL encryption & ad-free playback</span>
        </div>
      </div>
    </div>
  );
});
