"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  Settings,
  Palette,
  LayoutGrid,
  List,
  Hash,
  Info,
  Bug,
  Check,
  RotateCcw,
  Sparkles,
  UserPlus,
  LogIn,
  LogOut,
  CheckCircle2,
  Sliders,
  Play,
  Eye,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { useTheme } from "@/context/ThemeContext";
import { THEMES, DEFAULT_THEME, getTheme } from "@/lib/themes";
import { useSiteSettings, clearAllWatchedEpisodes } from "@/lib/user-settings";
import { usePageContentReady } from "@/lib/pageLoad";
import { cn } from "@/lib/utils";
import type { EpisodeViewMode } from "@/components/episodes/EpisodeViews";

export default function SettingsPage() {
  usePageContentReady(true);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && !!session?.user;

  const { theme, setTheme, customThemes } = useTheme();
  const activeTheme = useMemo(() => getTheme(theme, customThemes), [theme, customThemes]);

  const { settings, updateSettings, resetSettings } = useSiteSettings();
  const [clearedWatchedToast, setClearedWatchedToast] = useState(false);

  const pageBgClass = useMemo(() => {
    switch (theme) {
      case "global":
        return "bg-[#07080d]";
      case "glass":
        return "bg-transparent";
      case "oled":
        return "bg-[#000000]";
      case "cinema":
        return "bg-[#140509]";
      case "wisteria":
        return "bg-[#0e071c]";
      case "solaris":
        return "bg-[#100b05]";
      default:
        return "bg-[#07080d]";
    }
  }, [theme]);

  const episodeLayoutOptions: {
    mode: EpisodeViewMode;
    label: string;
    description: string;
    icon: typeof List;
  }[] = [
    {
      mode: "grid",
      label: "Grid Cards",
      description: "Visual episode cards with thumbnails, runtime, ratings, and descriptions.",
      icon: LayoutGrid,
    },
    {
      mode: "list",
      label: "Detailed List",
      description: "Horizontal rows showing full episode synopses, air dates, and metadata.",
      icon: List,
    },
    {
      mode: "numbers",
      label: "Compact Numbers",
      description: "Fast numbered tiles ideal for long-running series and anime.",
      icon: Hash,
    },
  ];

  const handleClearAllWatched = () => {
    clearAllWatchedEpisodes();
    setClearedWatchedToast(true);
    setTimeout(() => setClearedWatchedToast(false), 3000);
  };

  return (
    <div className={cn("min-h-screen text-white pb-28 md:pb-20 transition-colors duration-300", pageBgClass)}>
      <Sidebar />

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 md:pt-24 space-y-8">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-xs font-bold uppercase tracking-wider text-white/70">
              <Settings className="w-3.5 h-3.5 text-primary" />
              <span>Preferences & Customization</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Site Settings
            </h1>
            <p className="text-sm text-white/60 max-w-xl">
              Customize how CineStream looks and behaves. Your preferences are saved automatically in your browser.
            </p>
          </div>

          <button
            type="button"
            onClick={resetSettings}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-bold text-white/75 hover:text-white transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>

        {/* ── Browser Save & Account Sync Banner ── */}
        <section className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-r from-[#111827]/95 via-[#1e293b]/80 to-[#0f172a]/95 p-5 sm:p-6 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20 text-primary border border-primary/30">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  {isAuthenticated
                    ? `Signed in as ${session?.user?.name || session?.user?.email}`
                    : "Saved on this browser — Sign in to sync everything"}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-white/65 leading-relaxed max-w-2xl">
                {isAuthenticated
                  ? "Your settings, watch history, and wishlist are synced with your CineStream account across all devices."
                  : "Your settings are saved locally in this browser. To sync all settings, watch progress, and wishlist across all your devices, sign in or create a free account."}
              </p>
            </div>

            {isAuthenticated ? (
              <div className="flex items-center gap-3 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Synced
                </span>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: window.location.origin })}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-xs font-bold text-red-300 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 text-xs sm:text-sm font-black tracking-wide shadow-lg transition-all hover:scale-[1.02] active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Sign Up</span>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs sm:text-sm font-bold transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ── 1. Episode Display & Playback Preferences ── */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-white">
                <Sliders className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-white tracking-tight">
                  Episodes & Playback
                </h2>
                <p className="text-xs text-white/50">
                  Control how episodes are displayed on TV Show and Anime pages
                </p>
              </div>
            </div>
          </div>

          {/* Episode View Mode Selector */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-white/60">
              Default Episode View Style (TV Shows & Anime)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {episodeLayoutOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = settings.episodeViewMode === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => updateSettings({ episodeViewMode: opt.mode })}
                    className={cn(
                      "group relative flex flex-col justify-between p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer",
                      isSelected
                        ? "border-white/40 bg-white/[0.09] shadow-lg ring-1 ring-white/25"
                        : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-2.5">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center border transition-colors",
                          isSelected
                            ? "bg-white text-black border-white"
                            : "bg-white/[0.05] text-white/70 border-white/10 group-hover:text-white"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-white mb-1">{opt.label}</div>
                      <p className="text-xs text-white/50 leading-relaxed">{opt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Playback & Watched Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Auto-Mark Previous Episodes Watched */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>Auto-Mark Previous Episodes Watched</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">
                  When you click an episode (e.g. Episode 10), automatically mark earlier episodes (1–9) as watched.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoMarkPreviousWatched}
                onClick={() =>
                  updateSettings({ autoMarkPreviousWatched: !settings.autoMarkPreviousWatched })
                }
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                  settings.autoMarkPreviousWatched ? "bg-emerald-500" : "bg-white/15"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    settings.autoMarkPreviousWatched ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {/* Auto-Advance Next Episode */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Play className="w-4 h-4 text-cyan-400" />
                  <span>Sync & Auto-Advance Next Episode</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">
                  Automatically advance the site URL and episode tracker when an episode finishes or when clicking Next on Source 1.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoNextEpisode}
                onClick={() => updateSettings({ autoNextEpisode: !settings.autoNextEpisode })}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                  settings.autoNextEpisode ? "bg-emerald-500" : "bg-white/15"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    settings.autoNextEpisode ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>

          {/* Clear Watched Badges Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
            <div>
              <div className="text-xs font-bold text-white/80">Watched Episode Badges</div>
              <p className="text-xs text-white/45">
                You can reset watched episodes per show on its page, or clear all watched badges across the site here.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearAllWatched}
              className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-bold text-white/75 hover:text-white transition-all cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
              <span>{clearedWatchedToast ? "All Watched Badges Cleared!" : "Reset All Watched Badges"}</span>
            </button>
          </div>
        </section>

        {/* ── 2. Appearance & Themes ── */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-5 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-white">
                <Palette className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-white tracking-tight">
                  Theme Studio & Palette
                </h2>
                <p className="text-xs text-white/50">
                  Active theme:{" "}
                  <span style={{ color: activeTheme.accent }} className="font-bold">
                    {activeTheme.label}
                  </span>{" "}
                  — applies live across the entire site
                </p>
              </div>
            </div>

            {theme !== DEFAULT_THEME && (
              <button
                type="button"
                onClick={() => setTheme(DEFAULT_THEME)}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-bold text-white/75 hover:text-white transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Default Theme</span>
              </button>
            )}
          </div>

          {/* Live Preview Banner */}
          <div
            className="relative overflow-hidden rounded-xl border border-white/10 shadow-lg p-5 transition-all duration-300"
            style={{ background: activeTheme.preview }}
          >
            <div className="flex items-center justify-between text-xs mb-3">
              <span
                className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow"
                style={{ backgroundColor: activeTheme.accent, color: "#000" }}
              >
                {activeTheme.tagline || "Live Theme Preview"}
              </span>
              <span className="text-xs font-bold text-white/90">{activeTheme.label}</span>
            </div>
            <div className="p-4 rounded-xl border border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold text-white">{activeTheme.label}</div>
                <div className="text-xs text-white/65">{activeTheme.description}</div>
              </div>
              <span
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold shadow shrink-0"
                style={{ backgroundColor: activeTheme.accent, color: "#000" }}
              >
                Active
              </span>
            </div>
          </div>

          {/* Standard Themes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {THEMES.map((t) => {
              const selected = t.id === theme;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "group relative flex flex-col justify-between p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer",
                    selected
                      ? "border-white/50 bg-white/[0.09] shadow-lg ring-1 ring-white/25"
                      : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
                  )}
                >
                  <div className="w-full">
                    <div
                      className="h-14 w-full rounded-lg border border-white/10 mb-3 relative overflow-hidden"
                      style={{ background: t.preview }}
                    >
                      <span
                        className="absolute bottom-2 right-2 h-3.5 w-3.5 rounded-full ring-2 ring-black/60 shadow"
                        style={{ background: t.accent }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-white">{t.label}</span>
                      {selected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </div>
                    <p className="text-xs text-white/50 mt-1 line-clamp-2">{t.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom / Admin Themes if available */}
          {customThemes.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Special Admin Themes</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {customThemes.map((t) => {
                  const selected = t.id === theme;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={cn(
                        "group relative flex flex-col justify-between p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer",
                        selected
                          ? "border-amber-400/60 bg-amber-500/10 shadow-lg"
                          : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                      )}
                    >
                      <div className="w-full">
                        <div
                          className="h-12 w-full rounded-lg border border-white/10 mb-2.5 relative overflow-hidden"
                          style={{ background: t.preview }}
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-extrabold text-white">{t.label}</span>
                          {selected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ── 3. Info Page & Report Issue Section ── */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-white">
              <Info className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-tight">
                Information & Support
              </h2>
              <p className="text-xs text-white/50">
                Learn more about CineStream or report a broken stream or bug
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/landing"
              className="group flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-cyan-400/40 transition-all"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-white group-hover:text-cyan-300 transition-colors">
                    Site Info & Overview
                  </div>
                  <p className="text-xs text-white/50">
                    Explore CineStream features, platform info, and FAQ
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
            </Link>

            <Link
              href="/contact"
              className="group flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-rose-400/40 transition-all"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Bug className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-white group-hover:text-rose-300 transition-colors">
                    Report an Issue
                  </div>
                  <p className="text-xs text-white/50">
                    Report missing episodes, broken playback sources, or site bugs
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
