"use client";

import { memo } from "react";
import { X, Settings, Gauge, FastForward, PlayCircle, MonitorPlay, Sparkles } from "lucide-react";

interface PlayerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  autoPlayNext: boolean;
  onToggleAutoPlayNext: () => void;
  autoSkipIntro: boolean;
  onToggleAutoSkipIntro: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const PlayerSettingsModal = memo(function PlayerSettingsModal({
  isOpen,
  onClose,
  playbackSpeed,
  onSpeedChange,
  autoPlayNext,
  onToggleAutoPlayNext,
  autoSkipIntro,
  onToggleAutoSkipIntro,
}: PlayerSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md bg-gradient-to-b from-zinc-900 to-black border border-white/15 rounded-3xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.95)] z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">Player Settings</h3>
              <p className="text-xs text-white/50">Custom playback preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Speed Selector */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Gauge className="w-4 h-4 text-primary" />
            <span>Playback Speed</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5 p-1 bg-white/5 border border-white/10 rounded-2xl">
            {SPEED_OPTIONS.map((spd) => {
              const isSelected = playbackSpeed === spd;
              return (
                <button
                  key={spd}
                  onClick={() => onSpeedChange(spd)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {spd}x
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-2 border-t border-white/5">
          {/* Auto Play Next */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-3">
              <PlayCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <h4 className="text-xs font-bold text-white">Auto-Play Next Episode</h4>
                <p className="text-[11px] text-white/40">Continues playback when episode ends</p>
              </div>
            </div>
            <button
              onClick={onToggleAutoPlayNext}
              className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-1 ${
                autoPlayNext ? "bg-primary" : "bg-white/15"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  autoPlayNext ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Auto Skip Intro */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-3">
              <FastForward className="w-5 h-5 text-amber-400" />
              <div>
                <h4 className="text-xs font-bold text-white">Auto-Skip Opening Theme</h4>
                <p className="text-[11px] text-white/40">Skips intro sequences automatically</p>
              </div>
            </div>
            <button
              onClick={onToggleAutoSkipIntro}
              className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-1 ${
                autoSkipIntro ? "bg-primary" : "bg-white/15"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  autoSkipIntro ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
        >
          Save & Close
        </button>
      </div>
    </div>
  );
});
