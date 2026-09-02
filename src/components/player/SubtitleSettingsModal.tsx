"use client";

import { memo } from "react";
import { X, Subtitles, Type, Palette, Eye } from "lucide-react";

export interface SubtitleConfig {
  fontSize: "small" | "medium" | "large" | "extra";
  fontColor: string;
  bgColor: string;
  bgOpacity: number;
}

interface SubtitleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SubtitleConfig;
  onChange: (config: SubtitleConfig) => void;
  onOpenSubtitlesSearch?: () => void;
}

const FONT_SIZES = [
  { key: "small", label: "Small", size: "75%" },
  { key: "medium", label: "Normal", size: "100%" },
  { key: "large", label: "Large", size: "125%" },
  { key: "extra", label: "Huge", size: "150%" },
];

const COLORS = ["#FFFFFF", "#FDE047", "#38BDF8", "#4ADE80", "#F472B6"];
const OPACITIES = [0, 25, 50, 75, 100];

export const SubtitleSettingsModal = memo(function SubtitleSettingsModal({
  isOpen,
  onClose,
  config,
  onChange,
  onOpenSubtitlesSearch,
}: SubtitleSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md bg-gradient-to-b from-zinc-900 to-black border border-white/15 rounded-3xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.95)] z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <Subtitles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">Subtitle Style</h3>
              <p className="text-xs text-white/50">Custom caption rendering</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close subtitle settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick OpenSubtitles Action Button */}
        {onOpenSubtitlesSearch && (
          <button
            onClick={() => {
              onClose();
              onOpenSubtitlesSearch();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all text-emerald-300 group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Subtitles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white group-hover:text-emerald-200">
                Search OpenSubtitles (Community Subtitles)
              </span>
            </div>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300">
              FREE
            </span>
          </button>
        )}

        {/* Live Preview Box */}
        <div className="h-24 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-center p-4 relative overflow-hidden">
          <div
            className="font-bold px-3 py-1 rounded-lg text-center leading-snug"
            style={{
              color: config.fontColor,
              backgroundColor: `rgba(0, 0, 0, ${config.bgOpacity / 100})`,
              fontSize: config.fontSize === "small" ? "12px" : config.fontSize === "medium" ? "15px" : config.fontSize === "large" ? "18px" : "21px",
              textShadow: "0 2px 4px rgba(0,0,0,0.9)",
            }}
          >
            "Cine-Stream High-Definition Subtitles"
          </div>
        </div>

        {/* Font Size */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-white/80 flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-primary" /> Font Size
          </label>
          <div className="grid grid-cols-4 gap-2">
            {FONT_SIZES.map((f) => (
              <button
                key={f.key}
                onClick={() => onChange({ ...config, fontSize: f.key as any })}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  config.fontSize === f.key
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Text Color */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-white/80 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-primary" /> Text Color
          </label>
          <div className="flex items-center gap-3">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ ...config, fontColor: c })}
                className={`w-9 h-9 rounded-full border-2 transition-transform cursor-pointer ${
                  config.fontColor === c ? "scale-110 border-white ring-2 ring-primary" : "border-transparent opacity-70 hover:opacity-100"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Background Opacity */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-white/80 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-primary" /> Background Opacity
          </label>
          <div className="grid grid-cols-5 gap-2">
            {OPACITIES.map((op) => (
              <button
                key={op}
                onClick={() => onChange({ ...config, bgOpacity: op })}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  config.bgOpacity === op
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {op}%
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
        >
          Apply Styling
        </button>
      </div>
    </div>
  );
});
