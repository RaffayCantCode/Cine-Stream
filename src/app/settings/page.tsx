"use client";

import { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  Settings,
  User,
  Palette,
  Play,
  Info,
  Bug,
  CheckCircle2,
  RotateCcw,
  Tv,
  Sparkles,
  LogIn,
  LogOut,
  UserPlus,
  LayoutGrid,
  List,
  Hash,
  Check,
  ChevronDown,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { useTheme } from "@/context/ThemeContext";
import { THEMES, DEFAULT_THEME, getTheme, type ThemeDefinition } from "@/lib/themes";
import { useSiteSettings, clearAllWatchedEpisodes } from "@/lib/user-settings";
import { usePageContentReady } from "@/lib/pageLoad";
import { cn } from "@/lib/utils";
import type { EpisodeViewMode } from "@/components/episodes/EpisodeViews";

type SettingsTabId = "account" | "appearance" | "playback" | "support";

const EPISODE_VIEW_OPTIONS: {
  mode: EpisodeViewMode;
  label: string;
  icon: typeof LayoutGrid;
}[] = [
  { mode: "grid", label: "Grid", icon: LayoutGrid },
  { mode: "list", label: "List", icon: List },
  { mode: "numbers", label: "Numbers", icon: Hash },
];

const SETTINGS_TABS: {
  id: SettingsTabId;
  label: string;
  icon: typeof User;
}[] = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "playback", label: "Playback", icon: Play },
  { id: "support", label: "Support", icon: Info },
];

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

function SegmentedPillToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center p-1 rounded-full bg-white/[0.05] border border-white/[0.1] self-start sm:self-auto shrink-0"
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-[13px] transition-all duration-150 cursor-pointer select-none",
              isSelected
                ? "bg-white text-black font-semibold shadow-sm"
                : "text-white/65 hover:text-white font-medium"
            )}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white/80 shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm sm:text-[15px] font-semibold text-white leading-snug">
            {title}
          </div>
          <div className="text-xs sm:text-[13px] text-white/50 mt-0.5 leading-relaxed">
            {description}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 flex-wrap sm:justify-end shrink-0">
        {children}
      </div>
    </div>
  );
}

function ThemeSplitSwatch({ themeDef }: { themeDef: ThemeDefinition }) {
  const rightColor = themeDef.card || themeDef.background || "#18253B";
  return (
    <span
      aria-hidden="true"
      className="w-5 h-5 rounded-full overflow-hidden flex shrink-0 ring-1 ring-white/15"
    >
      <span className="w-1/2 h-full" style={{ backgroundColor: themeDef.accent }} />
      <span className="w-1/2 h-full" style={{ backgroundColor: rightColor }} />
    </span>
  );
}

function ThemeDropdown({
  themes,
  activeTheme,
  selectedId,
  onSelect,
}: {
  themes: ThemeDefinition[];
  activeTheme: ThemeDefinition;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center gap-2.5 rounded-full px-4 py-2 bg-white/[0.05] border transition-all cursor-pointer select-none",
          open
            ? "border-white/40 ring-1 ring-white/15"
            : "border-white/[0.15] hover:border-white/30"
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
        <ThemeSplitSwatch themeDef={activeTheme} />
        <span className="text-xs sm:text-[13px] font-semibold text-white whitespace-nowrap">
          {activeTheme.label}
        </span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-white/70 transition-transform duration-150 shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Theme options"
          className="absolute left-0 sm:left-auto sm:right-0 top-[calc(100%+8px)] z-50 w-56 rounded-2xl bg-[#12151e]/95 backdrop-blur-2xl border border-white/[0.1] shadow-2xl py-1.5 max-h-72 overflow-y-auto"
        >
          {themes.map((t) => {
            const isSelected = t.id === selectedId;
            return (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onSelect(t.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors cursor-pointer",
                  isSelected
                    ? "bg-white/[0.08] text-white font-semibold"
                    : "text-white/75 hover:text-white hover:bg-white/[0.05] font-medium"
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <ThemeSplitSwatch themeDef={t} />
                  <span className="text-xs sm:text-[13px] truncate">{t.label}</span>
                  {t.isCustom && (
                    <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                  )}
                </span>
                {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  usePageContentReady(true);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && !!session?.user;

  const { theme, setTheme, customThemes } = useTheme();
  const activeTheme = useMemo(() => getTheme(theme, customThemes), [theme, customThemes]);
  const allThemes = useMemo(
    () => (customThemes.length > 0 ? [...THEMES, ...customThemes] : THEMES),
    [customThemes]
  );

  const { settings, updateSettings, resetSettings } = useSiteSettings();
  const [activeTab, setActiveTab] = useState<SettingsTabId>("account");
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

  const handleTabSelect = (id: SettingsTabId) => {
    setActiveTab(id);
    const el = document.getElementById(`section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleClearAllWatched = () => {
    clearAllWatchedEpisodes();
    setClearedWatchedToast(true);
    setTimeout(() => setClearedWatchedToast(false), 3000);
  };

  const handleResetDefaults = () => {
    resetSettings();
    setTheme(DEFAULT_THEME);
  };

  const episodeModeOptions: SegmentedOption<EpisodeViewMode>[] = EPISODE_VIEW_OPTIONS.map(
    (opt) => {
      const Icon = opt.icon;
      return {
        value: opt.mode,
        label: opt.label,
        icon: <Icon className="w-3.5 h-3.5" />,
      };
    }
  );

  const booleanOptions: SegmentedOption<"on" | "off">[] = [
    { value: "on", label: "On" },
    { value: "off", label: "Off" },
  ];

  return (
    <div
      className={cn(
        "min-h-screen text-white pb-28 md:pb-20 transition-colors duration-300",
        pageBgClass
      )}
    >
      <Sidebar />

      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 md:pt-24 space-y-6">
        {/* ── Header & Horizontal Section Tabs ── */}
        <header className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Settings className="w-7 h-7 text-white/90" />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Settings
              </h1>
            </div>
            <span className="hidden sm:inline-flex text-xs text-white/45">
              Changes save automatically
            </span>
          </div>

          <nav
            aria-label="Settings sections"
            className="flex items-center gap-6 sm:gap-8 overflow-x-auto hide-scrollbar border-b border-white/[0.08]"
          >
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabSelect(tab.id)}
                  className={cn(
                    "relative flex items-center gap-2 pb-3 text-sm transition-colors whitespace-nowrap cursor-pointer shrink-0",
                    isActive
                      ? "text-white font-semibold"
                      : "text-white/55 hover:text-white/85 font-medium"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </header>

        {/* ── 1. Account Section ── */}
        <section
          id="section-account"
          className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8 scroll-mt-24"
        >
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Account
            </h2>
            <p className="text-xs sm:text-sm text-white/55 mt-1">
              Sign in to sync your settings, watchlist, and watch progress across devices.
            </p>
          </div>

          <div className="mt-6 divide-y divide-white/[0.07]">
            {isAuthenticated ? (
              <SettingRow
                icon={<User className="w-4 h-4 text-emerald-400" />}
                title={`Signed in as ${session?.user?.name || session?.user?.email}`}
                description="Your watchlist, watch history, and preferences are synced across devices."
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Synced
                </span>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: window.location.origin })}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] hover:bg-red-500/15 border border-white/[0.12] hover:border-red-500/30 text-white/85 hover:text-red-300 px-5 py-2 text-xs sm:text-[13px] font-semibold transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </SettingRow>
            ) : (
              <SettingRow
                title="Not signed in"
                description="Create an account or sign in to sync your data"
              >
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white text-black hover:bg-white/90 px-5 py-2 text-xs sm:text-[13px] font-semibold transition-all"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white px-5 py-2 text-xs sm:text-[13px] font-semibold transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Sign Up</span>
                </Link>
              </SettingRow>
            )}
          </div>
        </section>

        {/* ── 2. Appearance Section ── */}
        <section
          id="section-appearance"
          className="relative z-20 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8 scroll-mt-24"
        >
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Appearance
            </h2>
            <p className="text-xs sm:text-sm text-white/55 mt-1">
              Change the look of the site to suit your needs.
            </p>
          </div>

          <div className="mt-6 divide-y divide-white/[0.07]">
            {/* Theme Dropdown */}
            <SettingRow
              icon={<Palette className="w-4 h-4 text-white/75" />}
              title="Theme"
              description="Pick a color palette for the entire interface."
            >
              <ThemeDropdown
                themes={allThemes}
                activeTheme={activeTheme}
                selectedId={theme}
                onSelect={(id) => setTheme(id)}
              />
            </SettingRow>

            {/* TV Show Episode View Style */}
            <SettingRow
              icon={<Tv className="w-4 h-4 text-white/75" />}
              title="Episode View Style (TV Shows)"
              description="Choose how episodes appear on TV series pages."
            >
              <SegmentedPillToggle
                ariaLabel="TV Shows Episode View Style"
                value={settings.tvEpisodeViewMode}
                options={episodeModeOptions}
                onChange={(mode) =>
                  updateSettings({ tvEpisodeViewMode: mode, episodeViewMode: mode })
                }
              />
            </SettingRow>

            {/* Anime Episode View Style */}
            <SettingRow
              icon={<Sparkles className="w-4 h-4 text-white/75" />}
              title="Episode View Style (Anime)"
              description="Choose how episodes appear on anime series pages."
            >
              <SegmentedPillToggle
                ariaLabel="Anime Episode View Style"
                value={settings.animeEpisodeViewMode}
                options={episodeModeOptions}
                onChange={(mode) => updateSettings({ animeEpisodeViewMode: mode })}
              />
            </SettingRow>
          </div>
        </section>

        {/* ── 3. Playback Section ── */}
        <section
          id="section-playback"
          className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8 scroll-mt-24"
        >
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Playback
            </h2>
            <p className="text-xs sm:text-sm text-white/55 mt-1">
              Customize episode progression and watched history behavior.
            </p>
          </div>

          <div className="mt-6 divide-y divide-white/[0.07]">
            <SettingRow
              title="Auto-Advance Next Episode"
              description="Automatically advance to the next episode when playback finishes."
            >
              <SegmentedPillToggle
                ariaLabel="Auto-Advance Next Episode"
                value={settings.autoNextEpisode ? "on" : "off"}
                options={booleanOptions}
                onChange={(val) => updateSettings({ autoNextEpisode: val === "on" })}
              />
            </SettingRow>

            <SettingRow
              title="Auto-Mark Previous Episodes Watched"
              description="When you play an episode, automatically mark earlier episodes in that season as watched."
            >
              <SegmentedPillToggle
                ariaLabel="Auto-Mark Previous Episodes Watched"
                value={settings.autoMarkPreviousWatched ? "on" : "off"}
                options={booleanOptions}
                onChange={(val) =>
                  updateSettings({ autoMarkPreviousWatched: val === "on" })
                }
              />
            </SettingRow>

            <SettingRow
              title="Watched Episode Badges"
              description="Clear all watched episode indicators saved in your browser."
            >
              <button
                type="button"
                onClick={handleClearAllWatched}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white px-5 py-2 text-xs sm:text-[13px] font-semibold transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-white/75" />
                <span>{clearedWatchedToast ? "Cleared!" : "Reset Watched"}</span>
              </button>
            </SettingRow>

            <SettingRow
              title="Reset Settings"
              description="Restore all appearance and playback preferences to their default values."
            >
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white px-5 py-2 text-xs sm:text-[13px] font-semibold transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-white/75" />
                <span>Reset Defaults</span>
              </button>
            </SettingRow>
          </div>
        </section>

        {/* ── 4. Support Section ── */}
        <section
          id="section-support"
          className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8 scroll-mt-24"
        >
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Support & Information
            </h2>
            <p className="text-xs sm:text-sm text-white/55 mt-1">
              Learn more about CineStream or report a broken stream or bug.
            </p>
          </div>

          <div className="mt-6 divide-y divide-white/[0.07]">
            <SettingRow
              icon={<Info className="w-4 h-4 text-white/75" />}
              title="Site Info & Overview"
              description="Explore CineStream features, platform details, and FAQ."
            >
              <Link
                href="/landing"
                className="inline-flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white px-5 py-2 text-xs sm:text-[13px] font-semibold transition-all"
              >
                Open
              </Link>
            </SettingRow>

            <SettingRow
              icon={<Bug className="w-4 h-4 text-white/75" />}
              title="Report an Issue"
              description="Report missing episodes, broken playback sources, or site bugs."
            >
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white px-5 py-2 text-xs sm:text-[13px] font-semibold transition-all"
              >
                Report
              </Link>
            </SettingRow>
          </div>
        </section>
      </main>
    </div>
  );
}
