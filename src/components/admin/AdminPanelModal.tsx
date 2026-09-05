"use client";

import { memo, useState, useEffect, useCallback } from "react";
import { 
  X, 
  Megaphone, 
  ShieldCheck, 
  Save, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Eye,
  Layers,
  LayoutDashboard,
  Film,
  Star,
  Users,
  Palette,
  Search,
  Plus,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  UserX,
  RefreshCw,
  Flame,
  Sliders,
  Bug,
  Tv,
  Heart,
  Trophy,
  Bookmark,
  Play,
  Clapperboard,
  Compass,
  Zap,
  Award,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Server,
  EyeOff,
  Clock,
  Ban,
  RotateCcw,
  Edit3,
  Filter,
  Tag,
  Globe,
} from "lucide-react";
import { useAnnouncement } from "@/hooks/useAnnouncement";
import { useTheme } from "@/context/ThemeContext";
import { harmonizeAccentToCineStreamTheme, ArchetypeStyle } from "@/lib/themes";
import { SOURCE_TAGS, SOURCE_TAG_LABELS, clearSourceConfigCache, setSourceConfigCache } from "@/lib/streaming-config";
import { clearAllClientCaches } from "@/lib/utils";

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
}

type AdminTab = 
  | "dashboard" 
  | "announcements" 
  | "sections" 
  | "spotlight" 
  | "users" 
  | "franchises" 
  | "overrides"
  | "appearance"
  | "reports"
  | "streaming";

export const AdminPanelModal = memo(function AdminPanelModal({ isOpen, onClose, onOpen }: AdminPanelModalProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { refreshCustomThemes, previewCustomTheme, previewingTheme } = useTheme();

  // ── Announcement State ──
  const { message: currentAnnouncement, updatedAt: annUpdatedAt, saveAnnouncement, clearAnnouncement } = useAnnouncement();
  const [annInputText, setAnnInputText] = useState("");
  const [annSaving, setAnnSaving] = useState(false);

  // ── Dashboard Stats State ──
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Custom Sections State ──
  const [sections, setSections] = useState<any[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [editingSection, setEditingSection] = useState<any | null>(null);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);

  // ── Spotlight State ──
  const [spotlight, setSpotlight] = useState<any>({
    enabled: false,
    title: "",
    tagline: "",
    description: "",
    backdropPath: "",
    posterPath: "",
    targetUrl: "",
    mediaType: "movie",
    badge: "Spotlight",
  });
  const [spotlightSaving, setSpotlightSaving] = useState(false);

  // ── User Management State ──
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [currentAdminRole, setCurrentAdminRole] = useState("");

  // ── Franchises State ──
  const [customFranchisesList, setCustomFranchisesList] = useState<any[]>([]);
  const [franchisesLoading, setFranchisesLoading] = useState(false);
  const [editingFranchise, setEditingFranchise] = useState<any | null>(null);
  const [franchiseModalOpen, setFranchiseModalOpen] = useState(false);
  const [franchiseFilterTab, setFranchiseFilterTab] = useState<"all" | "presets" | "custom">("all");
  const [franchiseSearchQuery, setFranchiseSearchQuery] = useState("");

  // ── Entry Overrides State ──
  const [overridesList, setOverridesList] = useState<any[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [overrideSearchQuery, setOverrideSearchQuery] = useState("");
  const [overrideSearchType, setOverrideSearchType] = useState<"all" | "movie" | "tv" | "anime">("all");
  const [overrideSearchResults, setOverrideSearchResults] = useState<any[]>([]);
  const [overrideSearchLoading, setOverrideSearchLoading] = useState(false);
  const [selectedOverrideItem, setSelectedOverrideItem] = useState<any | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideFilterTab, setOverrideFilterTab] = useState<"all" | "upcoming" | "unavailable" | "hidden" | "customized">("all");
  const [overrideFilterQuery, setOverrideFilterQuery] = useState("");
  const [overrideGenreInput, setOverrideGenreInput] = useState("");
  const [overrideTagInput, setOverrideTagInput] = useState("");

  // ── Custom Themes State ──
  const [adminCustomThemes, setAdminCustomThemes] = useState<any[]>([]);
  const [adminThemesLoading, setAdminThemesLoading] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<any>({
    id: "",
    label: "",
    tagline: "Custom",
    description: "",
    background: "#080C14",
    card: "#141C2B",
    primary: "#38BDF8",
    accent: "#F43F5E",
    foreground: "#E2E8F0",
    enabled: true,
  });

  // ── Appearance State ──
  const [appearance, setAppearance] = useState({
    accentColor: "#7288AE",
    heroStyle: "cinematic",
    tagline: "Movies. TV. Anime. All in one place.",
  });
  const [appearanceSaving, setAppearanceSaving] = useState(false);

  // ── Streaming Sources State ──
  const [streamingConfig, setStreamingConfig] = useState<{
    movie: { key: string; tag: string }[];
    anime: { key: string; tag: string }[];
  }>({ movie: [], anime: [] });
  const [streamingLoading, setStreamingLoading] = useState(false);
  const [streamingSaving, setStreamingSaving] = useState(false);
  const [streamingDrag, setStreamingDrag] = useState<{ category: string; index: number } | null>(null);

  // ── Media Picker State (Used for Sections, Franchises, Spotlight) ──
  const [pickerSearchQuery, setPickerSearchQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<any[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);

  const [purgingCache, setPurgingCache] = useState(false);

  const showToast = (type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handlePurgeAllCaches = async () => {
    setPurgingCache(true);
    try {
      const res = await fetch("/api/admin/purge-cache", { method: "POST" });
      clearAllClientCaches();
      if (res.ok) {
        showToast("success", "All server, CDN, and local caches purged successfully!");
      } else {
        showToast("error", "Failed to purge server caches.");
      }
    } catch {
      clearAllClientCaches();
      showToast("error", "Error connecting to cache purge service.");
    } finally {
      setPurgingCache(false);
    }
  };

  // Sync announcement on open
  useEffect(() => {
    if (isOpen) {
      setAnnInputText(currentAnnouncement || "");
    }
  }, [isOpen, currentAnnouncement]);

  // Load Dashboard Stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const json = await res.json();
        if (json.success) setStats(json.data);
      }
    } catch {} finally {
      setStatsLoading(false);
    }
  }, []);

  // Load Custom Sections
  const loadSections = useCallback(async () => {
    setSectionsLoading(true);
    try {
      const res = await fetch("/api/admin/home-sections");
      if (res.ok) {
        const json = await res.json();
        if (json.success) setSections(json.sections || []);
      }
    } catch {} finally {
      setSectionsLoading(false);
    }
  }, []);

  // Load Spotlight
  const loadSpotlight = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/spotlight");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.spotlight) setSpotlight(json.spotlight);
      }
    } catch {}
  }, []);

  // Load Users
  const loadUsers = useCallback(async (query = "") => {
    setUsersLoading(true);
    try {
      const url = query ? `/api/admin/users?q=${encodeURIComponent(query)}` : "/api/admin/users";
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setUsersList(json.users || []);
          if (json.currentUserId) setCurrentAdminId(json.currentUserId);
          if (json.currentUserRole) setCurrentAdminRole(json.currentUserRole);
        }
      }
    } catch {} finally {
      setUsersLoading(false);
    }
  }, []);

  // Load Franchises
  const loadFranchises = useCallback(async () => {
    setFranchisesLoading(true);
    try {
      const res = await fetch("/api/admin/franchises");
      if (res.ok) {
        const json = await res.json();
        if (json.success) setCustomFranchisesList(json.franchises || []);
      }
    } catch {} finally {
      setFranchisesLoading(false);
    }
  }, []);

  // Load Entry Overrides
  const loadOverrides = useCallback(async (filter = overrideFilterTab, query = overrideFilterQuery) => {
    setOverridesLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter && filter !== "all") params.set("status", filter);
      if (query && query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/admin/entry-overrides?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setOverridesList(json.overrides || []);
      }
    } catch {} finally {
      setOverridesLoading(false);
    }
  }, [overrideFilterTab, overrideFilterQuery]);

  // Search Media for Entry Overrides
  const searchOverrideMedia = useCallback(async (query: string, type = overrideSearchType) => {
    if (!query || !query.trim()) {
      setOverrideSearchResults([]);
      return;
    }
    setOverrideSearchLoading(true);
    try {
      const trimmed = query.trim();
      let explicitType = type;
      if (trimmed.includes("-")) {
        const [p1] = trimmed.split("-");
        if (["movie", "tv", "anime"].includes(p1.toLowerCase())) {
          explicitType = p1.toLowerCase() as any;
        }
      }

      const res = await fetch(`/api/media/search?q=${encodeURIComponent(trimmed)}&type=${explicitType}`);
      if (res.ok) {
        const json = await res.json();
        setOverrideSearchResults(json.results || []);
      }
    } catch {
      setOverrideSearchResults([]);
    } finally {
      setOverrideSearchLoading(false);
    }
  }, [overrideSearchType]);

  // Load Appearance & Admin Custom Themes
  const loadAppearance = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.appearance) {
          setAppearance((prev) => ({ ...prev, ...json.appearance }));
        }
      }
    } catch {}
  }, []);

  const loadAdminThemes = useCallback(async () => {
    setAdminThemesLoading(true);
    try {
      const res = await fetch("/api/admin/themes");
      if (res.ok) {
        const json = await res.json();
        if (json.success) setAdminCustomThemes(json.themes || []);
      }
    } catch {} finally {
      setAdminThemesLoading(false);
    }
  }, []);

  const [reportsList, setReportsList] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const res = await fetch("/api/contact");
      if (res.ok) {
        const json = await res.json();
        if (json.reports) setReportsList(json.reports);
      }
    } catch {} finally {
      setReportsLoading(false);
    }
  }, []);

  // Load Streaming Sources config
  const loadStreaming = useCallback(async () => {
    setStreamingLoading(true);
    try {
      const res = await fetch("/api/admin/streaming", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.config) setStreamingConfig(json.config);
      }
    } catch {} finally {
      setStreamingLoading(false);
    }
  }, []);

  // Save Streaming Sources config
  const saveStreaming = useCallback(async () => {
    setStreamingSaving(true);
    try {
      const res = await fetch("/api/admin/streaming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(streamingConfig),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        if (json.config) {
          setStreamingConfig(json.config);
          setSourceConfigCache(json.config);
        } else {
          clearSourceConfigCache();
        }
        try {
          localStorage.setItem("cinestream_streaming_sources_updated", Date.now().toString());
          window.dispatchEvent(new CustomEvent("cinestream_streaming_sources_updated", { detail: json.config }));
        } catch {}
        showToast("success", "Source order saved — applied to media players");
      } else {
        showToast("error", json.error || "Failed to save source order");
      }
    } catch {
      showToast("error", "Failed to save source order");
    } finally {
      setStreamingSaving(false);
    }
  }, [streamingConfig]);

  // Reset Streaming Sources config to defaults
  const resetStreaming = useCallback(async () => {
    setStreamingSaving(true);
    try {
      const res = await fetch("/api/admin/streaming", { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        let finalConfig = json.config;
        if (!finalConfig) {
          const refetched = await fetch("/api/admin/streaming", { cache: "no-store" });
          const refetchedJson = await refetched.json().catch(() => ({}));
          if (refetchedJson.success && refetchedJson.config) finalConfig = refetchedJson.config;
        }
        if (finalConfig) {
          setStreamingConfig(finalConfig);
          setSourceConfigCache(finalConfig);
        } else {
          clearSourceConfigCache();
        }
        try {
          localStorage.setItem("cinestream_streaming_sources_updated", Date.now().toString());
          window.dispatchEvent(new CustomEvent("cinestream_streaming_sources_updated", { detail: finalConfig }));
        } catch {}
        showToast("success", "Restored default source order and tags");
      } else {
        showToast("error", json.error || "Failed to reset source order");
      }
    } catch {
      showToast("error", "Failed to reset source order");
    } finally {
      setStreamingSaving(false);
    }
  }, []);

  // Move a source within a category
  const moveStreamingSource = useCallback((category: "movie" | "anime", from: number, to: number) => {
    setStreamingConfig((prev) => {
      const list = [...(prev[category] || [])];
      if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return prev;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return { ...prev, [category]: list };
    });
  }, []);

  // Update a source tag within a category
  const updateStreamingTag = useCallback((category: "movie" | "anime", index: number, tag: string) => {
    setStreamingConfig((prev) => {
      const list = [...(prev[category] || [])];
      if (index < 0 || index >= list.length) return prev;
      list[index] = { ...list[index], tag };
      return { ...prev, [category]: list };
    });
  }, []);

  // Load data when active tab changes
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "dashboard") loadStats();
    if (activeTab === "sections") loadSections();
    if (activeTab === "spotlight") loadSpotlight();
    if (activeTab === "users") loadUsers(userQuery);
    if (activeTab === "franchises") loadFranchises();
    if (activeTab === "overrides") loadOverrides();
    if (activeTab === "reports") loadReports();
    if (activeTab === "streaming") loadStreaming();
    if (activeTab === "appearance") {
      loadAppearance();
      loadAdminThemes();
    }
  }, [isOpen, activeTab, loadStats, loadSections, loadSpotlight, loadUsers, loadFranchises, loadOverrides, loadReports, loadAppearance, loadAdminThemes, userQuery, loadStreaming]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Unified Media Search for Item Picker
  const searchMediaItems = useCallback(async (query: string) => {
    if (!query.trim()) {
      setPickerResults([]);
      return;
    }
    setPickerLoading(true);
    try {
      const res = await fetch(`/api/media/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const json = await res.json();
        setPickerResults(json.results || []);
      }
    } catch {} finally {
      setPickerLoading(false);
    }
  }, []);

  const renderPreviewBanner = () => {
    if (!previewingTheme) return null;
    return (
      <div className="fixed top-0 inset-x-0 z-[100] bg-zinc-950/95 border-b border-amber-500/30 backdrop-blur-xl px-4 pt-[calc(0.625rem+env(safe-area-inset-top))] pb-2.5 flex items-center justify-between shadow-2xl animate-fade-in-up">
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">Live Theme Preview Mode:</span>
            <span className="text-xs font-mono font-bold text-amber-400">{previewingTheme.label || "Draft Theme"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingTheme(previewingTheme);
              setThemeModalOpen(true);
              setActiveTab("appearance");
              if (onOpen) onOpen();
            }}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer border border-zinc-700/80 transition-colors"
          >
            Keep Editing / Modify Colors
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!previewingTheme.label?.trim()) {
                showToast("error", "Theme name is required before publishing");
                setEditingTheme(previewingTheme);
                setThemeModalOpen(true);
                setActiveTab("appearance");
                if (onOpen) onOpen();
                return;
              }
              const method = previewingTheme.id ? "PUT" : "POST";
              const res = await fetch("/api/admin/themes", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(previewingTheme),
              });
              if (res.ok) {
                previewCustomTheme(null);
                loadAdminThemes();
                refreshCustomThemes();
                showToast("success", `Theme "${previewingTheme.label}" published live!`);
              } else {
                showToast("error", "Failed to publish theme");
              }
            }}
            className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow cursor-pointer transition-colors"
          >
            Publish Theme Live
          </button>
          <button
            type="button"
            onClick={() => previewCustomTheme(null)}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors"
            title="Exit Live Preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  if (!isOpen) return renderPreviewBanner();

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 1: DASHBOARD OVERVIEW
  // ─────────────────────────────────────────────────────────────────────────────
  const renderDashboardTab = () => (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                System Administration
              </span>
              <span className="text-xs text-zinc-400 font-mono">v2.0</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Control Center & Telemetry
            </h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              Monitor platform metrics, control live announcements, configure homepage layouts, manage database roles, and publish themes.
            </p>
          </div>

          <button
            type="button"
            onClick={loadStats}
            className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors border border-zinc-700/70 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? "animate-spin text-sky-400" : ""}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Accounts</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white font-mono">
            {stats?.users?.total ?? "..."}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">
            {stats?.users?.admins ?? 0} Admins · {stats?.users?.regular ?? 0} Users
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Today</span>
            <Flame className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-400 font-mono">
            {stats?.users?.activeNow ?? "..."}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">Active within 24 hours</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Home Sections</span>
            <Film className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white font-mono">
            {stats?.catalog?.enabledCustomSections ?? 0}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">
            {stats?.catalog?.customSections ?? 0} configured rows
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Franchises</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white font-mono">
            {stats?.catalog?.totalFranchises ?? "..."}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">
            {stats?.catalog?.customFranchises ?? 0} collections
          </p>
        </div>
      </div>

      {/* Status & Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Features Status */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-400" />
            Live Features Status
          </h4>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-zinc-800/80">
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${stats?.features?.announcementActive ? "bg-emerald-400" : "bg-zinc-600"}`} />
                <span className="text-xs font-medium text-zinc-200">Hero Announcement</span>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${stats?.features?.announcementActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-400"}`}>
                {stats?.features?.announcementActive ? "Active" : "Off"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-zinc-800/80">
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${stats?.features?.spotlightActive ? "bg-amber-400" : "bg-zinc-600"}`} />
                <span className="text-xs font-medium text-zinc-200">Spotlight Hero Banner</span>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${stats?.features?.spotlightActive ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-zinc-800 text-zinc-400"}`}>
                {stats?.features?.spotlightActive ? "Enabled" : "Default 3-Card"}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-amber-400" />
            Quick Admin Navigation
          </h4>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("sections")}
              className="flex items-center gap-2 p-3 rounded-xl bg-black/40 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium transition-colors cursor-pointer text-left"
            >
              <Film className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="truncate">Add Home Row</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("appearance")}
              className="flex items-center gap-2 p-3 rounded-xl bg-black/40 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium transition-colors cursor-pointer text-left"
            >
              <Palette className="w-4 h-4 text-fuchsia-400 shrink-0" />
              <span className="truncate">Theme Studio</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("users")}
              className="flex items-center gap-2 p-3 rounded-xl bg-black/40 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium transition-colors cursor-pointer text-left"
            >
              <Users className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="truncate">User Accounts</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("franchises")}
              className="flex items-center gap-2 p-3 rounded-xl bg-black/40 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium transition-colors cursor-pointer text-left"
            >
              <Layers className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">New Franchise</span>
            </button>
          </div>
        </div>
      </div>

      {/* Smart Cache & Performance Management */}
      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              Smart Cache & High-Load Optimization
            </h4>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              All TMDB and Neon DB requests are automatically deduplicated and cached in bounded in-memory LRU storage (zero storage bloat, zero startup freeze). If you make database edits and want to instantly push changes everywhere, purge cache below.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                clearAllClientCaches();
                showToast("success", "Browser memory cache cleared.");
              }}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors border border-zinc-700/70 cursor-pointer"
            >
              Clear Local Cache
            </button>
            <button
              type="button"
              disabled={purgingCache}
              onClick={handlePurgeAllCaches}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
            >
              {purgingCache ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              <span>{purgingCache ? "Purging..." : "Purge All Site & CDN Cache"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 2: ANNOUNCEMENTS
  // ─────────────────────────────────────────────────────────────────────────────
  const renderAnnouncementsTab = () => (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${currentAnnouncement ? "bg-emerald-400" : "bg-zinc-600"}`} />
          <div>
            <p className="text-xs sm:text-sm font-semibold text-white">
              Status: {currentAnnouncement ? <span className="text-emerald-400">Active on Hero</span> : <span className="text-zinc-400">No Active Announcement</span>}
            </p>
            {annUpdatedAt && (
              <p className="text-[10px] text-zinc-500">
                Last updated: {new Date(annUpdatedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {currentAnnouncement && (
          <button
            type="button"
            onClick={async () => {
              setAnnSaving(true);
              const res = await clearAnnouncement();
              setAnnSaving(false);
              if (res.success) {
                setAnnInputText("");
                showToast("success", "Announcement cleared.");
              } else {
                showToast("error", res.error || "Failed to clear.");
              }
            }}
            disabled={annSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg border border-rose-500/20 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Announcement</span>
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="ann-input" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Announcement Text
          </label>
          <span className={`text-[11px] font-mono ${annInputText.length > 250 ? "text-amber-400" : "text-zinc-500"}`}>
            {annInputText.length} / 300
          </span>
        </div>
        <textarea
          id="ann-input"
          rows={3}
          value={annInputText}
          onChange={(e) => setAnnInputText(e.target.value)}
          placeholder="e.g. Welcome to CineStream! New season anime & 4K movies are now streaming live."
          maxLength={300}
          className="w-full px-4 py-3 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs sm:text-sm focus:outline-none focus:border-primary transition-colors resize-none"
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setAnnInputText("Welcome to CineStream! New season anime & 4K movies are now streaming live.")}
          className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
        >
          Use Template
        </button>

        <button
          type="button"
          onClick={async () => {
            if (!annInputText.trim()) {
              showToast("error", "Please enter an announcement message.");
              return;
            }
            setAnnSaving(true);
            const res = await saveAnnouncement(annInputText.trim());
            setAnnSaving(false);
            if (res.success) {
              showToast("success", "Announcement published live!");
            } else {
              showToast("error", res.error || "Failed to save.");
            }
          }}
          disabled={annSaving}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow transition-colors cursor-pointer disabled:opacity-50"
        >
          {annSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Publish Live</span>
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 3: CUSTOM HOMEPAGE SECTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  const renderSectionsTab = () => (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Film className="w-4 h-4 text-indigo-400" />
            Custom Homepage Rows
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Create custom curated rows (e.g. Weekend Picks, Staff Favorites) and pick which titles appear.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingSection({
              id: "",
              title: "",
              description: "",
              enabled: true,
              orderIndex: sections.length,
              items: [],
            });
            setSectionModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Custom Row</span>
        </button>
      </div>

      {sectionsLoading ? (
        <div className="flex items-center justify-center py-16 text-zinc-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-xs font-medium">Loading homepage sections...</span>
        </div>
      ) : sections.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-black/40 border border-zinc-800/80 space-y-3">
          <Film className="w-10 h-10 mx-auto text-zinc-600" />
          <p className="text-sm font-semibold text-zinc-300">No custom sections created yet</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Create custom rows like "Weekend Picks" or "Staff Favorites" and search titles to fill them.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((sec, idx) => (
            <div
              key={sec.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={async () => {
                      if (idx === 0) return;
                      const next = [...sections];
                      const temp = next[idx];
                      next[idx] = next[idx - 1];
                      next[idx - 1] = temp;
                      setSections(next);
                      await fetch("/api/admin/home-sections", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sections: next.map((s, i) => ({ ...s, orderIndex: i })) }),
                      });
                    }}
                    className="p-1 rounded bg-black/50 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === sections.length - 1}
                    onClick={async () => {
                      if (idx === sections.length - 1) return;
                      const next = [...sections];
                      const temp = next[idx];
                      next[idx] = next[idx + 1];
                      next[idx + 1] = temp;
                      setSections(next);
                      await fetch("/api/admin/home-sections", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sections: next.map((s, i) => ({ ...s, orderIndex: i })) }),
                      });
                    }}
                    className="p-1 rounded bg-black/50 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{sec.title}</h4>
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${sec.enabled ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500"}`}>
                      {sec.enabled ? "Live" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">{sec.description || "Custom section"}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {Array.isArray(sec.items) ? sec.items.length : 0} items configured
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch("/api/admin/home-sections", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: sec.id, enabled: !sec.enabled }),
                    });
                    if (res.ok) {
                      loadSections();
                      showToast("success", `Section ${!sec.enabled ? "enabled" : "disabled"}`);
                    }
                  }}
                  className="p-2 rounded-xl bg-black/50 hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                  title="Toggle Live"
                >
                  {sec.enabled ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-zinc-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingSection({ ...sec });
                    setSectionModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  Edit Section
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Delete custom row "${sec.title}"?`)) return;
                    const res = await fetch("/api/admin/home-sections", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: sec.id }),
                    });
                    if (res.ok) {
                      loadSections();
                      showToast("success", "Section deleted.");
                    }
                  }}
                  className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section Editor Modal */}
      {sectionModalOpen && editingSection && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden sm:overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-[#0D1117] border-0 sm:border border-zinc-800 rounded-none sm:rounded-2xl shadow-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] max-h-[100dvh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-800 shrink-0 bg-zinc-900/40 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <h3 className="text-sm sm:text-base font-bold text-white">
                {editingSection.id ? "Edit Custom Row" : "Create Custom Row"}
              </h3>
              <button
                type="button"
                onClick={() => setSectionModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body Container with min-h-0 */}
            <div className="overflow-y-auto space-y-4 flex-1 min-h-0 px-4 sm:px-6 py-3.5 sm:py-4 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Row Title</label>
                  <input
                    type="text"
                    value={editingSection.title}
                    onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })}
                    placeholder="e.g. Weekend Picks"
                    className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs font-semibold focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Subtitle / Description</label>
                  <input
                    type="text"
                    value={editingSection.description || ""}
                    onChange={(e) => setEditingSection({ ...editingSection, description: e.target.value })}
                    placeholder="e.g. Handpicked movies for your weekend binge"
                    className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Optional Row Icon Picker */}
              <div className="pt-2 border-t border-zinc-800">
                <label className="text-xs font-semibold text-zinc-400 uppercase block mb-1.5">
                  Optional Row Icon
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 sm:max-h-none overflow-y-auto custom-scrollbar p-0.5">
                  {[
                    { id: "Film", label: "Film", IconComp: Film },
                    { id: "Sparkles", label: "Sparkles", IconComp: Sparkles },
                    { id: "Flame", label: "Flame", IconComp: Flame },
                    { id: "Tv", label: "TV", IconComp: Tv },
                    { id: "Star", label: "Star", IconComp: Star },
                    { id: "Heart", label: "Heart", IconComp: Heart },
                    { id: "Trophy", label: "Trophy", IconComp: Trophy },
                    { id: "Bookmark", label: "Bookmark", IconComp: Bookmark },
                    { id: "Play", label: "Play", IconComp: Play },
                    { id: "Clapperboard", label: "Cinema", IconComp: Clapperboard },
                    { id: "Compass", label: "Discover", IconComp: Compass },
                    { id: "Zap", label: "Action", IconComp: Zap },
                    { id: "Award", label: "Award", IconComp: Award },
                  ].map((ic) => {
                    const isSelected = (editingSection.icon || "Film") === ic.id;
                    const IconC = ic.IconComp;
                    return (
                      <button
                        key={ic.id}
                        type="button"
                        onClick={() => setEditingSection({ ...editingSection, icon: ic.id })}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                          isSelected
                            ? "bg-primary/20 border-primary text-white shadow-sm"
                            : "bg-black/40 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                        }`}
                      >
                        <IconC className={`w-3.5 h-3.5 ${isSelected ? "text-primary" : "text-zinc-400"}`} />
                        <span>{ic.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Media Picker */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <label className="text-xs font-semibold text-zinc-400 uppercase flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-sky-400" />
                  Search & Add Titles
                </label>
                <input
                  type="text"
                  value={pickerSearchQuery}
                  onChange={(e) => {
                    setPickerSearchQuery(e.target.value);
                    searchMediaItems(e.target.value);
                  }}
                  placeholder="Search Movies, TV Shows, Anime..."
                  className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
                />

                {pickerLoading && (
                  <div className="py-2 text-center text-xs text-zinc-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> Searching catalog...
                  </div>
                )}

                {pickerResults.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-44 sm:max-h-48 overflow-y-auto p-2 rounded-xl bg-black/50 border border-zinc-800/80 custom-scrollbar">
                    {pickerResults.map((item) => (
                      <div
                        key={`${item.media_type}_${item.id}`}
                        className="flex items-center justify-between gap-2 p-1.5 sm:p-2 rounded-lg bg-zinc-900/60 border border-zinc-800"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {item.poster_path && <img src={item.poster_path} alt="" className="w-6 h-8 object-cover rounded shrink-0" />}
                          <p className="text-[11px] font-semibold text-zinc-200 truncate">{item.title || item.name}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const current = Array.isArray(editingSection.items) ? editingSection.items : [];
                            const cleanType = item.media_type || (item.first_air_date ? "tv" : "movie");
                            const cleanTargetUrl = cleanType === "anime"
                              ? `/anime/${item.anilistId || item.id}`
                              : `/${cleanType}/${item.id}`;
                            const fullItem = {
                              ...item,
                              id: Number(item.id) || item.id,
                              media_type: cleanType,
                              targetUrl: cleanTargetUrl,
                              target_url: cleanTargetUrl,
                            };
                            setEditingSection({ ...editingSection, items: [...current, fullItem] });
                            showToast("success", `Added ${item.title || item.name}`);
                          }}
                          className="p-1.5 sm:p-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 cursor-pointer shrink-0"
                          title="Add to row"
                        >
                          <Plus className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Items in Section with Drag-and-Drop Re-ordering */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-400 uppercase">
                    Titles in Row ({editingSection.items?.length || 0})
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">*Drag items or use arrows to reorder</span>
                </div>
                {(!editingSection.items || editingSection.items.length === 0) ? (
                  <p className="text-xs text-zinc-500 italic py-2">No titles added yet. Search above to add items to this row.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {editingSection.items?.map((it: any, itemIdx: number) => (
                      <div
                        key={itemIdx}
                        draggable
                        onDragStart={() => setDraggedItemIndex(itemIdx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggedItemIndex === null || draggedItemIndex === itemIdx) return;
                          const current = Array.isArray(editingSection.items) ? [...editingSection.items] : [];
                          const [moved] = current.splice(draggedItemIndex, 1);
                          current.splice(itemIdx, 0, moved);
                          setEditingSection({ ...editingSection, items: current });
                          setDraggedItemIndex(null);
                        }}
                        className={`flex items-center justify-between gap-2 p-2 rounded-xl border transition-all ${
                          draggedItemIndex === itemIdx
                            ? "bg-sky-500/10 border-sky-500/60 opacity-60"
                            : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <GripVertical className="w-3.5 h-3.5 text-zinc-500 shrink-0 cursor-grab active:cursor-grabbing hidden sm:block" />
                          {it.poster_path && (
                            <img
                              src={it.poster_path.startsWith('http') ? it.poster_path : `https://image.tmdb.org/t/p/w92${it.poster_path}`}
                              alt=""
                              className="w-6 h-8 object-cover rounded shrink-0 bg-zinc-800"
                            />
                          )}
                          <span className="text-xs font-semibold text-zinc-200 truncate">{it.title || it.name}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={itemIdx === 0}
                            onClick={() => {
                              const current = Array.isArray(editingSection.items) ? [...editingSection.items] : [];
                              const temp = current[itemIdx];
                              current[itemIdx] = current[itemIdx - 1];
                              current[itemIdx - 1] = temp;
                              setEditingSection({ ...editingSection, items: current });
                            }}
                            className="p-1.5 sm:p-1 rounded bg-black/50 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move Left/Up"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={itemIdx === (editingSection.items?.length || 0) - 1}
                            onClick={() => {
                              const current = Array.isArray(editingSection.items) ? [...editingSection.items] : [];
                              const temp = current[itemIdx];
                              current[itemIdx] = current[itemIdx + 1];
                              current[itemIdx + 1] = temp;
                              setEditingSection({ ...editingSection, items: current });
                            }}
                            className="p-1.5 sm:p-1 rounded bg-black/50 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move Right/Down"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = editingSection.items.filter((_: any, i: number) => i !== itemIdx);
                              setEditingSection({ ...editingSection, items: newItems });
                            }}
                            className="text-rose-400 hover:bg-rose-500/10 p-1.5 sm:p-1 rounded cursor-pointer transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-zinc-800 bg-[#0D1117] shrink-0 sticky bottom-0 z-10 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setSectionModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!editingSection.title?.trim()) {
                    showToast("error", "Row title is required");
                    return;
                  }
                  const isEditing = Boolean(editingSection.id);
                  const method = isEditing ? "PUT" : "POST";
                  const payload = isEditing
                    ? {
                        id: editingSection.id,
                        title: editingSection.title,
                        subtitle: editingSection.description || editingSection.subtitle || "",
                        icon: editingSection.icon || "Film",
                        items: editingSection.items || [],
                        enabled: editingSection.enabled ?? true,
                      }
                    : {
                        title: editingSection.title,
                        subtitle: editingSection.description || editingSection.subtitle || "",
                        icon: editingSection.icon || "Film",
                        items: editingSection.items || [],
                        enabled: true,
                      };

                  const res = await fetch("/api/admin/home-sections", {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });

                  if (res.ok) {
                    setSectionModalOpen(false);
                    loadSections();
                    showToast("success", `Custom row ${isEditing ? "updated" : "created"}!`);
                  } else {
                    const errJson = await res.json().catch(() => ({}));
                    showToast("error", errJson.error || "Failed to save section");
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow cursor-pointer active:scale-95 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Save Row</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 4: SPOTLIGHT HERO BANNER
  // ─────────────────────────────────────────────────────────────────────────────
  const renderSpotlightTab = () => (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" />
            Spotlight Featured Hero Banner
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Search and pick any Movie, TV Show, or Anime to feature as the spotlight banner on the homepage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-300">Enable Spotlight</span>
          <button
            type="button"
            onClick={() => setSpotlight({ ...spotlight, enabled: !spotlight.enabled })}
            className="p-1 cursor-pointer"
          >
            {spotlight.enabled ? <ToggleRight className="w-7 h-7 text-emerald-400" /> : <ToggleLeft className="w-7 h-7 text-zinc-600" />}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Search Media to Feature */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-sky-400" />
            Search & Pick Media Entry
          </label>
          <input
            type="text"
            value={pickerSearchQuery}
            onChange={(e) => {
              setPickerSearchQuery(e.target.value);
              searchMediaItems(e.target.value);
            }}
            placeholder="Type to search (e.g. Inception, Solo Leveling, Breaking Bad)..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs font-medium focus:outline-none focus:border-primary"
          />

          {pickerLoading && (
            <div className="py-2 text-center text-xs text-zinc-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> Searching catalog...
            </div>
          )}

          {pickerResults.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-2 rounded-xl bg-black/50 border border-zinc-800/80 custom-scrollbar">
              {pickerResults.map((item) => (
                <button
                  key={`${item.media_type}_${item.id}`}
                  type="button"
                  onClick={() => {
                    const cleanTitle = item.title || item.name || "Featured Title";
                    const cleanType = item.media_type || "movie";
                    const cleanTargetUrl = cleanType === "anime" 
                      ? `/anime/${item.anilistId || item.id}` 
                      : `/${cleanType}/${item.id}`;
                    const cleanBackdrop = item.backdrop_path 
                      ? (item.backdrop_path.startsWith("http") ? item.backdrop_path : `https://image.tmdb.org/t/p/original${item.backdrop_path}`)
                      : item.poster_path;

                    setSpotlight({
                      ...spotlight,
                      title: cleanTitle,
                      mediaType: cleanType,
                      backdropPath: cleanBackdrop,
                      posterPath: item.poster_path,
                      targetUrl: cleanTargetUrl,
                      description: item.overview || spotlight.description || "",
                    });
                    setPickerResults([]);
                    setPickerSearchQuery("");
                    showToast("success", `Selected "${cleanTitle}" for Spotlight!`);
                  }}
                  className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 transition-colors text-left group cursor-pointer"
                >
                  {item.poster_path ? (
                    <img src={item.poster_path} alt="" className="w-8 h-11 object-cover rounded shrink-0" />
                  ) : (
                    <div className="w-8 h-11 bg-zinc-800 rounded flex items-center justify-center text-[9px] text-zinc-500">No img</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">{item.title}</p>
                    <span className="text-[9px] uppercase font-mono text-zinc-500">{item.media_type}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Media Preview Card */}
        {spotlight.title ? (
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {spotlight.backdropPath || spotlight.posterPath ? (
                  <img
                    src={spotlight.backdropPath || spotlight.posterPath}
                    alt=""
                    className="w-16 h-16 sm:w-20 sm:h-14 object-cover rounded-xl border border-zinc-800 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center text-xs text-zinc-500">
                    No Art
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white truncate">{spotlight.title}</h4>
                    <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {spotlight.mediaType}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">
                    Target Route: <span className="text-sky-300 font-mono">{spotlight.targetUrl || "/"}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearchQuery(spotlight.title);
                    searchMediaItems(spotlight.title);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  Change Media
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSpotlight({
                      ...spotlight,
                      title: "",
                      backdropPath: "",
                      posterPath: "",
                      targetUrl: "",
                      description: "",
                    });
                    showToast("success", "Removed selected media.");
                  }}
                  className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer transition-colors"
                  title="Remove Selected Media"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-black/40 border border-zinc-800/80 text-center text-xs text-zinc-500 italic">
            No media selected. Search above to choose a movie, TV show, or anime for the hero banner.
          </div>
        )}

        {/* Customization overrides */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase">Banner Badge / Tagline</label>
            <input
              type="text"
              value={spotlight.badge || ""}
              onChange={(e) => setSpotlight({ ...spotlight, badge: e.target.value })}
              placeholder="e.g. Featured Spotlight, New Episode Streaming"
              className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs font-semibold focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase">Title (Override)</label>
            <input
              type="text"
              value={spotlight.title || ""}
              onChange={(e) => setSpotlight({ ...spotlight, title: e.target.value })}
              placeholder="Title override..."
              className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs font-semibold focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-400 uppercase">Description / Synopsis</label>
          <textarea
            rows={2}
            value={spotlight.description || ""}
            onChange={(e) => setSpotlight({ ...spotlight, description: e.target.value })}
            placeholder="Custom synopsis..."
            className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary resize-none font-medium"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={async () => {
            setSpotlightSaving(true);
            try {
              const res = await fetch("/api/admin/spotlight", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(spotlight),
              });
              if (res.ok) {
                try {
                  window.dispatchEvent(new CustomEvent("sv:spotlight-updated", { detail: spotlight }));
                } catch {}
                showToast("success", "Spotlight settings saved!");
              } else {
                showToast("error", "Failed to save spotlight");
              }
            } finally {
              setSpotlightSaving(false);
            }
          }}
          disabled={spotlightSaving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow cursor-pointer disabled:opacity-50"
        >
          {spotlightSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save Spotlight</span>
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 5: USER MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────
  const renderUsersTab = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-400" />
            User Accounts & Role Directory
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage registered accounts, database roles, and account status.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={userQuery}
            onChange={(e) => {
              setUserQuery(e.target.value);
              loadUsers(e.target.value);
            }}
            placeholder="Search email or name..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {usersLoading ? (
        <div className="flex items-center justify-center py-16 text-zinc-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-xs font-medium">Loading directory...</span>
        </div>
      ) : usersList.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 text-xs font-medium">
          No users matching query
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-1">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Privacy Active: User emails are permanently masked for account privacy.</span>
          </div>
          {usersList.map((u) => {
            const isSelf = u.id === currentAdminId;
            const isOwner = u.role === "owner";
            const isAdmin = u.role === "admin";
            const isDisabled = u.status === "disabled";
            const isCallerOwner = currentAdminRole === "owner";

            return (
              <div
                key={u.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {u.image ? (
                    <img src={u.image} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-zinc-700" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300">
                      {u.name?.charAt(0) || "U"}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-semibold text-white truncate max-w-[160px] sm:max-w-[200px]">
                        {u.name}
                      </span>
                      {isSelf && (
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          You
                        </span>
                      )}
                      {isOwner ? (
                        <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Owner
                        </span>
                      ) : (
                        <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded ${isAdmin ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-zinc-800 text-zinc-400"}`}>
                          {u.role}
                        </span>
                      )}
                      {isDisabled && (
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono tracking-wider truncate">{u.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {isOwner ? (
                    <span className="text-[11px] font-medium text-amber-400 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      Site Owner
                    </span>
                  ) : (
                    <>
                      {/* Toggle Admin Role (Only visible to Site Owner) */}
                      {!isSelf && isCallerOwner && (
                        <button
                          type="button"
                          onClick={async () => {
                            const newRole = isAdmin ? "user" : "admin";
                            if (!confirm(`Change ${u.name}'s role to ${newRole}?`)) return;
                            const res = await fetch("/api/admin/users", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ userId: u.id, role: newRole }),
                            });
                            if (res.ok) {
                              loadUsers(userQuery);
                              showToast("success", `${u.name} is now ${newRole}!`);
                            } else {
                              const errData = await res.json().catch(() => ({}));
                              showToast("error", errData.error || "Failed to update role");
                            }
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                            isAdmin
                              ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20"
                              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                          }`}
                        >
                          {isAdmin ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          <span>{isAdmin ? "Remove Admin" : "Make Admin"}</span>
                        </button>
                      )}

                      {/* Delete Account Button (Only Site Owner can delete Admin accounts) */}
                      {!isSelf && (!isAdmin || isCallerOwner) && (
                        <button
                          type="button"
                          onClick={async () => {
                            const displayName = u.name ? `${u.name} (${u.email})` : u.email;
                            if (!confirm(`Do you want to delete this user's "${displayName}" account?`)) return;
                            const res = await fetch(`/api/admin/users?userId=${encodeURIComponent(u.id)}`, {
                              method: "DELETE",
                            });
                            if (res.ok) {
                              loadUsers(userQuery);
                              showToast("success", `Deleted user account "${displayName}"`);
                            } else {
                              const errData = await res.json().catch(() => ({}));
                              showToast("error", errData.error || "Failed to delete user account");
                            }
                          }}
                          className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 cursor-pointer transition-colors"
                          title={`Delete account for ${u.name || u.email}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 6: FRANCHISES & COLLECTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  const renderFranchisesTab = () => {
    const filteredFranchises = customFranchisesList.filter((col) => {
      if (franchiseFilterTab === "presets" && !col.isPreset) return false;
      if (franchiseFilterTab === "custom" && col.isPreset) return false;
      if (franchiseSearchQuery.trim()) {
        const q = franchiseSearchQuery.toLowerCase().trim();
        return col.name.toLowerCase().includes(q) || (col.overview && col.overview.toLowerCase().includes(q));
      }
      return true;
    });

    const presetCount = customFranchisesList.filter(c => c.isPreset).length;
    const customCount = customFranchisesList.filter(c => !c.isPreset).length;

    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              Franchise Collections & Sagas
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Manage both preset built-in sagas (Transformers, Marvel, DC) and custom dynamic collections rendered on `/browse/franchises`.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingFranchise({
                id: "",
                name: "",
                overview: "",
                posterPath: "",
                backdropPath: "",
                enabled: true,
                parts: [],
              });
              setFranchiseModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Custom Collection</span>
          </button>
        </div>

        {/* Filter Chips & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "all", label: `All (${customFranchisesList.length})` },
              { id: "presets", label: `Preset Franchises (${presetCount})` },
              { id: "custom", label: `Custom Collections (${customCount})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFranchiseFilterTab(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  franchiseFilterTab === f.id
                    ? "bg-zinc-700 text-white shadow-sm"
                    : "bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={franchiseSearchQuery}
              onChange={(e) => setFranchiseSearchQuery(e.target.value)}
              placeholder="Filter franchises..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {franchisesLoading ? (
          <div className="flex items-center justify-center py-16 text-zinc-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-xs font-medium">Loading collections...</span>
          </div>
        ) : filteredFranchises.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-black/40 border border-zinc-800/80 space-y-3">
            <Layers className="w-10 h-10 mx-auto text-zinc-600" />
            <p className="text-sm font-semibold text-zinc-300">No franchises found matching your filter</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Create a new custom collection or clear your filter to browse existing franchises.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFranchises.map((col) => (
              <div
                key={col.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {col.posterPath ? (
                    <img src={col.posterPath.startsWith("http") ? col.posterPath : `https://image.tmdb.org/t/p/w200${col.posterPath}`} alt="" className="w-10 h-14 object-cover rounded-lg shrink-0" />
                  ) : (
                    <div className="w-10 h-14 bg-zinc-800 rounded-lg flex items-center justify-center text-[10px] text-zinc-500">No img</div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white truncate">{col.name}</h4>
                      {col.isPreset ? (
                        <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-400 border border-sky-500/30 text-[10px] font-bold">
                          Preset
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/30 text-[10px] font-bold">
                          Custom
                        </span>
                      )}
                      {col.isOverridden && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                          Modified Override
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{col.overview || "No description"}</p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      {Array.isArray(col.parts) ? col.parts.length : 0} items in collection • ID: <code className="text-zinc-400 font-mono">{col.id}</code>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFranchise({ ...col });
                      setFranchiseModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Edit Collection
                  </button>

                  {col.isPreset && col.isOverridden && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Reset "${col.name}" back to default code configuration? This will remove custom overrides.`)) return;
                        const res = await fetch("/api/admin/franchises", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: col.id }),
                        });
                        if (res.ok) {
                          loadFranchises();
                          showToast("success", `Reset "${col.name}" to code defaults.`);
                        }
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium cursor-pointer border border-amber-500/20"
                      title="Reset to code default"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  )}

                  {!col.isPreset && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete custom collection "${col.name}"?`)) return;
                        const res = await fetch("/api/admin/franchises", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: col.id }),
                        });
                        if (res.ok) {
                          loadFranchises();
                          showToast("success", "Collection deleted.");
                        }
                      }}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                      title="Delete Collection"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Franchise Editor Modal */}
        {franchiseModalOpen && editingFranchise && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden sm:overflow-y-auto">
            <div className="relative w-full max-w-3xl bg-[#0D1117] border-0 sm:border border-zinc-800 rounded-none sm:rounded-2xl shadow-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] max-h-[100dvh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-800 shrink-0 bg-zinc-900/40 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {editingFranchise.id ? `Edit Franchise: ${editingFranchise.name}` : "Create Franchise Collection"}
                  </h3>
                  {editingFranchise.isPreset && (
                    <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-bold">
                      Built-in Preset
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setFranchiseModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="overflow-y-auto space-y-4 flex-1 min-h-0 px-4 sm:px-6 py-3.5 sm:py-4 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase">Collection Name</label>
                    <input
                      type="text"
                      value={editingFranchise.name || ""}
                      onChange={(e) => setEditingFranchise({ ...editingFranchise, name: e.target.value })}
                      placeholder="e.g. Transformers Collection"
                      className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs font-semibold focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase">Poster Image URL</label>
                    <input
                      type="text"
                      value={editingFranchise.posterPath || ""}
                      onChange={(e) => setEditingFranchise({ ...editingFranchise, posterPath: e.target.value })}
                      placeholder="https://... or /path.jpg"
                      className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase">Backdrop Image URL</label>
                    <input
                      type="text"
                      value={editingFranchise.backdropPath || ""}
                      onChange={(e) => setEditingFranchise({ ...editingFranchise, backdropPath: e.target.value })}
                      placeholder="https://... or /path.jpg"
                      className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase">Franchise ID (Slug)</label>
                    <input
                      type="text"
                      value={editingFranchise.id || ""}
                      disabled={Boolean(editingFranchise.id)}
                      onChange={(e) => setEditingFranchise({ ...editingFranchise, id: e.target.value })}
                      placeholder="e.g. custom-saga"
                      className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs disabled:opacity-60 font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Overview / Description</label>
                  <textarea
                    rows={2}
                    value={editingFranchise.overview || ""}
                    onChange={(e) => setEditingFranchise({ ...editingFranchise, overview: e.target.value })}
                    placeholder="e.g. The war between the heroic Autobots and the evil Decepticons."
                    className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                {/* Media Picker */}
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <label className="text-xs font-semibold text-zinc-400 uppercase flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-sky-400" />
                    Search & Add Entries (Movies, TV Shows, Anime)
                  </label>
                  <input
                    type="text"
                    value={pickerSearchQuery}
                    onChange={(e) => {
                      setPickerSearchQuery(e.target.value);
                      searchMediaItems(e.target.value);
                    }}
                    placeholder="Search titles to add to franchise..."
                    className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
                  />

                  {pickerResults.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-black/50 border border-zinc-800/80 custom-scrollbar">
                      {pickerResults.map((item) => (
                        <div
                          key={`${item.media_type}_${item.id}`}
                          className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {item.poster_path && <img src={item.poster_path} alt="" className="w-6 h-8 object-cover rounded shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-zinc-200 truncate">{item.title}</p>
                              <span className="text-[9px] uppercase font-mono text-zinc-500">{item.media_type} • ID {item.id}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const current = Array.isArray(editingFranchise.parts) ? editingFranchise.parts : [];
                              const cleanId = isNaN(Number(item.id)) ? item.id : Number(item.id);
                              const newPart = {
                                id: cleanId,
                                media_type: item.media_type || "movie",
                                title: item.title,
                                poster_path: item.poster_path,
                              };
                              setEditingFranchise({ ...editingFranchise, parts: [...current, newPart] });
                              if (!editingFranchise.posterPath && item.poster_path) {
                                setEditingFranchise((prev: any) => ({ ...prev, posterPath: item.poster_path, backdropPath: item.backdrop_path }));
                              }
                              showToast("success", `Added ${item.title}`);
                            }}
                            className="p-1.5 sm:p-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 cursor-pointer shrink-0"
                            title="Add to Franchise"
                          >
                            <Plus className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Items in Collection */}
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <label className="text-xs font-semibold text-zinc-400 uppercase">
                    Entries in Collection ({editingFranchise.parts?.length || 0})
                  </label>
                  {(!editingFranchise.parts || editingFranchise.parts.length === 0) ? (
                    <p className="text-xs text-zinc-500 italic py-2">No entries added yet. Search above to add items.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {editingFranchise.parts?.map((pt: any, ptIdx: number) => (
                        <div key={ptIdx} className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-zinc-200 truncate block">{pt.title || pt.name || `Item ${pt.id}`}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">#{ptIdx + 1} • {pt.media_type || "movie"} ({pt.id})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newParts = editingFranchise.parts.filter((_: any, i: number) => i !== ptIdx);
                              setEditingFranchise({ ...editingFranchise, parts: newParts });
                            }}
                            className="text-rose-400 hover:bg-rose-500/10 p-1.5 sm:p-1 rounded cursor-pointer transition-colors shrink-0"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-zinc-800 bg-[#0D1117] shrink-0 sticky bottom-0 z-10 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setFranchiseModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!editingFranchise.name?.trim()) {
                      showToast("error", "Collection name is required");
                      return;
                    }
                    const method = editingFranchise.id ? "PUT" : "POST";
                    const res = await fetch("/api/admin/franchises", {
                      method,
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(editingFranchise),
                    });
                    if (res.ok) {
                      setFranchiseModalOpen(false);
                      loadFranchises();
                      showToast("success", "Franchise collection saved!");
                    } else {
                      showToast("error", "Failed to save collection");
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow cursor-pointer active:scale-95 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Franchise</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB: ENTRY OVERRIDES & CUSTOMIZATION SYSTEM
  // ─────────────────────────────────────────────────────────────────────────────
  const renderOverridesTab = () => {
    const activeCount = overridesList.length;
    const upcomingCount = overridesList.filter((o) => o.isUpcoming || o.status === "upcoming").length;
    const unavailableCount = overridesList.filter((o) => o.isUnavailable || o.status === "unavailable").length;
    const hiddenCount = overridesList.filter((o) => o.isHidden || o.status === "hidden").length;
    const customizedCount = overridesList.filter(
      (o) => Boolean(o.customTitle || o.customDescription || (o.customGenres && o.customGenres.length > 0) || o.customPoster || o.customBackdrop)
    ).length;

    const filteredOverrides = overridesList.filter((item) => {
      if (overrideFilterTab === "upcoming" && !(item.isUpcoming || item.status === "upcoming")) return false;
      if (overrideFilterTab === "unavailable" && !(item.isUnavailable || item.status === "unavailable")) return false;
      if (overrideFilterTab === "hidden" && !(item.isHidden || item.status === "hidden")) return false;
      if (overrideFilterTab === "customized" && !Boolean(item.customTitle || item.customDescription || (item.customGenres && item.customGenres.length > 0) || item.customPoster || item.customBackdrop)) return false;

      if (overrideFilterQuery.trim()) {
        const q = overrideFilterQuery.toLowerCase().trim();
        return (
          item.mediaId.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          (item.customTitle && item.customTitle.toLowerCase().includes(q)) ||
          (item.customDescription && item.customDescription.toLowerCase().includes(q))
        );
      }
      return true;
    });

    const openEditorForMedia = (item: any) => {
      const cleanType = (item.mediaType || item.media_type || "movie").toLowerCase().trim();
      let cleanId = String(item.mediaId || item.id || "").trim();
      const typePrefix = `${cleanType}-`;
      while (cleanId.toLowerCase().startsWith(typePrefix)) {
        cleanId = cleanId.slice(typePrefix.length);
      }
      const compoundId = `${cleanType}-${cleanId}`;

      // Check if existing override exists
      const existing = overridesList.find((o) =>
        o.id === compoundId ||
        o.id === `${cleanType}-${cleanId}` ||
        o.mediaId === cleanId ||
        o.mediaId === `${cleanType}-${cleanId}` ||
        (o.mediaType === cleanType && o.mediaId === cleanId) ||
        (item.id && o.id === item.id)
      ) || (item.mediaType ? item : null);

      const title = existing?.customTitle || existing?.defaultTitle || item.customTitle || item.defaultTitle || item.title || item.name || "";
      const poster = existing?.customPoster || existing?.defaultPoster || item.customPoster || item.defaultPoster || item.poster_path || item.poster || "";
      const backdrop = existing?.customBackdrop || existing?.defaultBackdrop || item.customBackdrop || item.defaultBackdrop || item.backdrop_path || item.backdrop || "";
      const overview = existing?.customDescription || existing?.defaultOverview || item.customDescription || item.defaultOverview || item.overview || item.description || "";

      setSelectedOverrideItem({
        id: compoundId,
        mediaType: cleanType,
        mediaId: cleanId,
        defaultTitle: title || `Title (${cleanType} ${cleanId})`,
        defaultPoster: poster,
        defaultBackdrop: backdrop,
        defaultOverview: overview,
        status: existing?.status || item.status || "default",
        isHidden: Boolean(existing?.isHidden ?? item.isHidden ?? false),
        isUpcoming: Boolean(existing?.isUpcoming ?? item.isUpcoming ?? (existing?.status === "upcoming" || item.status === "upcoming")),
        isUnavailable: Boolean(existing?.isUnavailable ?? item.isUnavailable ?? (existing?.status === "unavailable" || item.status === "unavailable")),
        customTitle: existing?.customTitle || item.customTitle || title,
        customDescription: existing?.customDescription || item.customDescription || overview,
        customGenres: Array.isArray(existing?.customGenres) ? existing.customGenres : (Array.isArray(item.customGenres) ? item.customGenres : []),
        customTags: Array.isArray(existing?.customTags) ? existing.customTags : (Array.isArray(item.customTags) ? item.customTags : []),
        customReleaseDate: existing?.customReleaseDate || item.customReleaseDate || "",
        customPoster: existing?.customPoster || item.customPoster || poster,
        customBackdrop: existing?.customBackdrop || item.customBackdrop || backdrop,
        notes: existing?.notes || item.notes || "",
      });
      setOverrideModalOpen(true);
    };

    const handleCreateDirectOverride = () => {
      if (!overrideSearchQuery.trim()) return;
      const q = overrideSearchQuery.trim();
      let cleanType = overrideSearchType === "all" ? "anime" : overrideSearchType;
      let cleanId = q;

      if (q.includes("-")) {
        const parts = q.split("-");
        const prefix = parts[0].toLowerCase();
        if (["movie", "tv", "anime"].includes(prefix)) {
          cleanType = prefix as any;
          cleanId = parts.slice(1).join("-");
        }
      }

      openEditorForMedia({
        id: cleanId,
        mediaId: cleanId,
        mediaType: cleanType,
        media_type: cleanType,
        title: "",
        name: "",
      });
    };

    return (
      <div className="space-y-6">
        {/* Banner Section */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Entry Management & Overrides</h3>
          </div>
          <p className="text-xs text-zinc-400">
            Control individual Movies, TV Shows, and Anime behavior on the public site. Mark titles as <span className="text-amber-400 font-semibold">Upcoming</span> or <span className="text-zinc-300 font-semibold">Unavailable</span> to prevent broken player crashes, hide entries completely, or customize metadata and tags non-destructively.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
            <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800 text-center">
              <span className="text-[10px] text-zinc-500 uppercase font-mono block">Total Overrides</span>
              <span className="text-sm font-black text-white">{activeCount}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <span className="text-[10px] text-amber-400 uppercase font-mono block">Upcoming</span>
              <span className="text-sm font-black text-amber-300">{upcomingCount}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-800/40 border border-zinc-700/50 text-center">
              <span className="text-[10px] text-zinc-400 uppercase font-mono block">Unavailable</span>
              <span className="text-sm font-black text-zinc-200">{unavailableCount}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
              <span className="text-[10px] text-rose-400 uppercase font-mono block">Hidden</span>
              <span className="text-sm font-black text-rose-300">{hiddenCount}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-center col-span-2 sm:col-span-1">
              <span className="text-[10px] text-sky-400 uppercase font-mono block">Custom Metadata</span>
              <span className="text-sm font-black text-sky-300">{customizedCount}</span>
            </div>
          </div>
        </div>

        {/* Section 1: Search & Override Finder */}
        <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
          <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Search className="w-4 h-4 text-sky-400" />
            Find Title to Customize / Override
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={overrideSearchType}
              onChange={(e) => {
                const t = e.target.value as any;
                setOverrideSearchType(t);
                if (overrideSearchQuery) searchOverrideMedia(overrideSearchQuery, t);
              }}
              className="px-3 py-2 rounded-xl bg-black/60 border border-zinc-800 text-white text-xs font-semibold focus:outline-none focus:border-primary"
            >
              <option value="all">All Media</option>
              <option value="movie">Movies</option>
              <option value="tv">TV Shows</option>
              <option value="anime">Anime</option>
            </select>
            <div className="relative flex-1">
              <input
                type="text"
                value={overrideSearchQuery}
                onChange={(e) => {
                  setOverrideSearchQuery(e.target.value);
                  searchOverrideMedia(e.target.value);
                }}
                placeholder="Search title by name or enter ID (e.g. frieren s3, movie-1858, tv-1399, anime-16498)..."
                className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-black/60 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
              />
              {overrideSearchLoading && (
                <Loader2 className="w-4 h-4 text-zinc-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>
          </div>

          {/* Quick Direct Custom Override Button if query is present */}
          {overrideSearchQuery.trim().length > 0 && (
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <div className="text-xs text-zinc-300 truncate">
                Override or customize entry directly for <span className="text-primary font-bold">&quot;{overrideSearchQuery.trim()}&quot;</span>
              </div>
              <button
                type="button"
                onClick={handleCreateDirectOverride}
                className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shrink-0 cursor-pointer shadow transition-all"
              >
                + Custom Entry Override
              </button>
            </div>
          )}

          {/* Search Results Grid */}
          {overrideSearchResults.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <span className="text-[11px] font-bold text-zinc-400 uppercase">Search Results ({overrideSearchResults.length})</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto custom-scrollbar p-1">
                {overrideSearchResults.map((item) => {
                  const cleanType = (item.media_type || overrideSearchType).toLowerCase();
                  const cleanId = String(item.id);
                  const compoundId = `${cleanType}-${cleanId}`;
                  const existing = overridesList.find((o) => o.id === compoundId || (o.mediaType === cleanType && o.mediaId === cleanId) || o.mediaId === cleanId);

                  return (
                    <div
                      key={`${cleanType}-${cleanId}`}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/40 border border-zinc-800 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.poster_path ? (
                          <img src={item.poster_path} alt="" className="w-8 h-11 object-cover rounded-lg shrink-0" />
                        ) : (
                          <div className="w-8 h-11 bg-zinc-800 rounded-lg flex items-center justify-center text-[8px] text-zinc-500">No img</div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{item.title || item.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                              {cleanType}
                            </span>
                            {item.release_date && (
                              <span className="text-[10px] text-zinc-500">{item.release_date.slice(0, 4)}</span>
                            )}
                            {existing && (
                              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Overridden
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openEditorForMedia(item)}
                        className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
                      >
                        Customize
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Active Overrides List */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: "all", label: `All (${activeCount})` },
                { id: "upcoming", label: `Upcoming (${upcomingCount})` },
                { id: "unavailable", label: `Unavailable (${unavailableCount})` },
                { id: "hidden", label: `Hidden (${hiddenCount})` },
                { id: "customized", label: `Customized (${customizedCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setOverrideFilterTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    overrideFilterTab === tab.id
                      ? "bg-zinc-700 text-white shadow-sm"
                      : "bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Filter input */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={overrideFilterQuery}
                onChange={(e) => setOverrideFilterQuery(e.target.value)}
                placeholder="Search overrides..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {overridesLoading ? (
            <div className="flex items-center justify-center py-16 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-xs font-medium">Loading overrides...</span>
            </div>
          ) : filteredOverrides.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-black/40 border border-zinc-800/80 space-y-3">
              <Sliders className="w-10 h-10 mx-auto text-zinc-600" />
              <p className="text-sm font-semibold text-zinc-300">No active overrides found</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Use the search box above to find any movie, TV show, or anime and configure custom behavior.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOverrides.map((item) => {
                const isUpcoming = Boolean(item.isUpcoming || item.status === "upcoming");
                const isUnavailable = Boolean(item.isUnavailable || item.status === "unavailable");
                const isHidden = Boolean(item.isHidden || item.status === "hidden");
                const hasCustomMeta = Boolean(item.customTitle || item.customDescription || (item.customGenres && item.customGenres.length > 0) || item.customPoster || item.customBackdrop);
                const itemTags: string[] = Array.isArray(item.customTags) ? item.customTags : [];

                return (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.customPoster || item.defaultPoster || item.poster || item.poster_path ? (
                        <img
                          src={item.customPoster || item.defaultPoster || item.poster || item.poster_path}
                          alt=""
                          className="w-10 h-14 object-cover rounded-lg shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-zinc-800 rounded-lg flex items-center justify-center text-[10px] text-zinc-500 font-bold uppercase">
                          {item.mediaType}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white truncate">
                            {item.customTitle || item.defaultTitle || item.title || item.name || `Title (${item.mediaType} ${item.mediaId})`}
                          </h4>
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            {item.mediaType} • ID {item.mediaId}
                          </span>
                          {isUpcoming && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                              Upcoming
                            </span>
                          )}
                          {isUnavailable && (
                            <span className="px-2 py-0.5 rounded-md bg-zinc-700/50 text-zinc-300 border border-zinc-600/50 text-[10px] font-bold">
                              Unavailable
                            </span>
                          )}
                          {isHidden && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                              Hidden
                            </span>
                          )}
                          {hasCustomMeta && (
                            <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-400 border border-sky-500/30 text-[10px] font-bold">
                              Custom Meta
                            </span>
                          )}
                          {itemTags.map((tag, tagIdx) => (
                            <span key={tagIdx} className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                              🏷️ {tag}
                            </span>
                          ))}
                        </div>

                        {item.customDescription && (
                          <p className="text-xs text-zinc-400 line-clamp-1 mt-1">{item.customDescription}</p>
                        )}

                        <p className="text-[11px] text-zinc-500 mt-1">
                          Last updated by <span className="text-zinc-400">{item.updatedBy || "Admin"}</span> • {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "Recently"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditorForMedia(item)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Edit Override
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Reset all overrides for "${item.customTitle || item.mediaId}"?`)) return;
                          const res = await fetch("/api/admin/entry-overrides", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: item.id, mediaType: item.mediaType, mediaId: item.mediaId }),
                          });
                          if (res.ok) {
                            clearAllClientCaches();
                            loadOverrides();
                            showToast("success", "Override reset to default.");
                          }
                        }}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                        title="Reset all overrides"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Override Editor Modal */}
        {overrideModalOpen && selectedOverrideItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden sm:overflow-y-auto">
            <div className="relative w-full max-w-3xl bg-[#0D1117] border-0 sm:border border-zinc-800 rounded-none sm:rounded-2xl shadow-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] max-h-[100dvh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-800 shrink-0 bg-zinc-900/40 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Sliders className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">
                      Manage Entry: {selectedOverrideItem.customTitle || selectedOverrideItem.defaultTitle}
                    </h3>
                    <p className="text-[11px] text-zinc-400 font-mono">
                      Type: {selectedOverrideItem.mediaType} • ID: {selectedOverrideItem.mediaId}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="overflow-y-auto space-y-5 flex-1 min-h-0 px-4 sm:px-6 py-4 custom-scrollbar">
                {/* 1. Status Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white uppercase tracking-wider">
                    Entry Visibility & Availability Status
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Default */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOverrideItem({
                          ...selectedOverrideItem,
                          status: "default",
                          isUpcoming: false,
                          isUnavailable: false,
                          isHidden: false,
                        });
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        !selectedOverrideItem.isUpcoming && !selectedOverrideItem.isUnavailable && !selectedOverrideItem.isHidden
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/20"
                          : "bg-black/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <span className="text-xs font-bold block mb-1">Live / Default</span>
                      <span className="text-[10px] text-zinc-500 leading-tight">Standard playback & active streaming</span>
                    </button>

                    {/* Upcoming */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOverrideItem({
                          ...selectedOverrideItem,
                          status: "upcoming",
                          isUpcoming: true,
                          isUnavailable: false,
                          isHidden: false,
                        });
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        selectedOverrideItem.isUpcoming
                          ? "bg-amber-500/15 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/30"
                          : "bg-black/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <span className="text-xs font-bold block mb-1">Upcoming</span>
                      <span className="text-[10px] text-zinc-500 leading-tight">Expected soon; suppresses broken player</span>
                    </button>

                    {/* Unavailable */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOverrideItem({
                          ...selectedOverrideItem,
                          status: "unavailable",
                          isUpcoming: false,
                          isUnavailable: true,
                          isHidden: false,
                        });
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        selectedOverrideItem.isUnavailable
                          ? "bg-zinc-700/40 border-zinc-500 text-zinc-200 ring-1 ring-zinc-500/30"
                          : "bg-black/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <span className="text-xs font-bold block mb-1">Unavailable</span>
                      <span className="text-[10px] text-zinc-500 leading-tight">Shows clean unavailable notice</span>
                    </button>

                    {/* Hidden */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOverrideItem({
                          ...selectedOverrideItem,
                          status: "hidden",
                          isUpcoming: false,
                          isUnavailable: false,
                          isHidden: true,
                        });
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        selectedOverrideItem.isHidden
                          ? "bg-rose-500/15 border-rose-500/50 text-rose-300 ring-1 ring-rose-500/30"
                          : "bg-black/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <span className="text-xs font-bold block mb-1">Hide Completely</span>
                      <span className="text-[10px] text-zinc-500 leading-tight">Filtered from search & recommendations</span>
                    </button>
                  </div>
                </div>

                {/* 2. Metadata Overrides */}
                <div className="space-y-4 pt-3 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white uppercase tracking-wider">
                      Metadata Overrides (Non-Destructive)
                    </label>
                    <span className="text-[11px] text-zinc-500">Leave blank to use default API metadata</span>
                  </div>

                  {/* Custom Title */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                      <span>Custom Title</span>
                      {selectedOverrideItem.customTitle && (
                        <button
                          type="button"
                          onClick={() => setSelectedOverrideItem({ ...selectedOverrideItem, customTitle: "" })}
                          className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                        >
                          Clear override
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={selectedOverrideItem.customTitle}
                      onChange={(e) => setSelectedOverrideItem({ ...selectedOverrideItem, customTitle: e.target.value })}
                      placeholder={selectedOverrideItem.defaultTitle || "Override title..."}
                      className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary font-semibold"
                    />
                  </div>

                  {/* Custom Description */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                      <span>Custom Overview / Description</span>
                      {selectedOverrideItem.customDescription && (
                        <button
                          type="button"
                          onClick={() => setSelectedOverrideItem({ ...selectedOverrideItem, customDescription: "" })}
                          className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                        >
                          Clear override
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      value={selectedOverrideItem.customDescription}
                      onChange={(e) => setSelectedOverrideItem({ ...selectedOverrideItem, customDescription: e.target.value })}
                      placeholder={selectedOverrideItem.defaultOverview || "Override plot summary / overview..."}
                      className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary resize-none"
                    />
                  </div>

                  {/* Custom Genres */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                      <span>Custom Genres</span>
                      {selectedOverrideItem.customGenres?.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedOverrideItem({ ...selectedOverrideItem, customGenres: [] })}
                          className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                        >
                          Clear all genres
                        </button>
                      )}
                    </div>

                    {/* Genre Tag list */}
                    <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
                      {selectedOverrideItem.customGenres?.map((g: string, i: number) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-medium border border-zinc-700"
                        >
                          {g}
                          <button
                            type="button"
                            onClick={() => {
                              const next = selectedOverrideItem.customGenres.filter((_: any, idx: number) => idx !== i);
                              setSelectedOverrideItem({ ...selectedOverrideItem, customGenres: next });
                            }}
                            className="hover:text-rose-400 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={overrideGenreInput}
                        onChange={(e) => setOverrideGenreInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && overrideGenreInput.trim()) {
                            e.preventDefault();
                            const val = overrideGenreInput.trim();
                            const current = selectedOverrideItem.customGenres || [];
                            if (!current.includes(val)) {
                              setSelectedOverrideItem({ ...selectedOverrideItem, customGenres: [...current, val] });
                            }
                            setOverrideGenreInput("");
                          }
                        }}
                        placeholder="Type a genre and press Enter (e.g. Action, Sci-Fi, Shounen)..."
                        className="flex-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!overrideGenreInput.trim()) return;
                          const val = overrideGenreInput.trim();
                          const current = selectedOverrideItem.customGenres || [];
                          if (!current.includes(val)) {
                            setSelectedOverrideItem({ ...selectedOverrideItem, customGenres: [...current, val] });
                          }
                          setOverrideGenreInput("");
                        }}
                        className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* 3. Custom Tags / Badges */}
                  <div className="pt-2 border-t border-zinc-800/80">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                      <span className="flex items-center gap-1 text-purple-300 font-bold">
                        🏷️ Custom Entry Tags & Badges
                      </span>
                      {selectedOverrideItem.customTags?.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedOverrideItem({ ...selectedOverrideItem, customTags: [] })}
                          className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                        >
                          Clear all tags
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5 mb-2">
                      Tags appear as highlighted badges on media cards, browse grids, and hero banners.
                    </p>

                    {/* Active Tags list */}
                    <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
                      {selectedOverrideItem.customTags?.map((tag: string, i: number) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-200 text-xs font-bold border border-purple-500/40 shadow-sm"
                        >
                          🏷️ {tag}
                          <button
                            type="button"
                            onClick={() => {
                              const next = selectedOverrideItem.customTags.filter((_: any, idx: number) => idx !== i);
                              setSelectedOverrideItem({ ...selectedOverrideItem, customTags: next });
                            }}
                            className="hover:text-rose-400 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* Tag input */}
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={overrideTagInput}
                        onChange={(e) => setOverrideTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && overrideTagInput.trim()) {
                            e.preventDefault();
                            const val = overrideTagInput.trim();
                            const current = selectedOverrideItem.customTags || [];
                            if (!current.includes(val)) {
                              setSelectedOverrideItem({ ...selectedOverrideItem, customTags: [...current, val] });
                            }
                            setOverrideTagInput("");
                          }
                        }}
                        placeholder="Add custom tag (e.g. Trending, Staff Pick, 4K HDR, Dubbed, Exclusive)..."
                        className="flex-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!overrideTagInput.trim()) return;
                          const val = overrideTagInput.trim();
                          const current = selectedOverrideItem.customTags || [];
                          if (!current.includes(val)) {
                            setSelectedOverrideItem({ ...selectedOverrideItem, customTags: [...current, val] });
                          }
                          setOverrideTagInput("");
                        }}
                        className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        Add Tag
                      </button>
                    </div>

                    {/* Quick Preset Tag Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-zinc-500 uppercase font-mono">Quick Presets:</span>
                      {["Trending", "Featured", "Upcoming", "Staff Pick", "4K HDR", "Sub/Dub", "Exclusive", "Season Finale", "Classic"].map((preset) => {
                        const isAdded = selectedOverrideItem.customTags?.includes(preset);
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              const current = selectedOverrideItem.customTags || [];
                              if (isAdded) {
                                setSelectedOverrideItem({ ...selectedOverrideItem, customTags: current.filter((t: string) => t !== preset) });
                              } else {
                                setSelectedOverrideItem({ ...selectedOverrideItem, customTags: [...current, preset] });
                              }
                            }}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isAdded
                                ? "bg-purple-500 text-white font-bold"
                                : "bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 border border-zinc-700/50"
                            }`}
                          >
                            {isAdded ? `✓ ${preset}` : `+ ${preset}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Poster & Backdrop URLs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                        <span>Custom Poster Image URL</span>
                        {selectedOverrideItem.customPoster && (
                          <button
                            type="button"
                            onClick={() => setSelectedOverrideItem({ ...selectedOverrideItem, customPoster: "" })}
                            className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={selectedOverrideItem.customPoster}
                        onChange={(e) => setSelectedOverrideItem({ ...selectedOverrideItem, customPoster: e.target.value })}
                        placeholder="https://..."
                        className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                        <span>Custom Backdrop Image URL</span>
                        {selectedOverrideItem.customBackdrop && (
                          <button
                            type="button"
                            onClick={() => setSelectedOverrideItem({ ...selectedOverrideItem, customBackdrop: "" })}
                            className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={selectedOverrideItem.customBackdrop}
                        onChange={(e) => setSelectedOverrideItem({ ...selectedOverrideItem, customBackdrop: e.target.value })}
                        placeholder="https://..."
                        className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Release Date & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                        <span>Custom Release Date</span>
                        {selectedOverrideItem.customReleaseDate && (
                          <button
                            type="button"
                            onClick={() => setSelectedOverrideItem({ ...selectedOverrideItem, customReleaseDate: "" })}
                            className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={selectedOverrideItem.customReleaseDate}
                        onChange={(e) => setSelectedOverrideItem({ ...selectedOverrideItem, customReleaseDate: e.target.value })}
                        placeholder="YYYY-MM-DD (e.g. 2026-11-15)"
                        className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-400 uppercase">Internal Admin Notes</label>
                      <input
                        type="text"
                        value={selectedOverrideItem.notes || ""}
                        onChange={(e) => setSelectedOverrideItem({ ...selectedOverrideItem, notes: e.target.value })}
                        placeholder="e.g. Upcoming season expected winter..."
                        className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky Modal Footer */}
              <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-zinc-800 bg-[#0D1117] shrink-0 sticky bottom-0 z-10 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Reset all overrides for "${selectedOverrideItem.customTitle || selectedOverrideItem.mediaId}"?`)) return;
                    const res = await fetch("/api/admin/entry-overrides", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: selectedOverrideItem.id, mediaType: selectedOverrideItem.mediaType, mediaId: selectedOverrideItem.mediaId }),
                    });
                    if (res.ok) {
                      clearAllClientCaches();
                      loadOverrides();
                      setOverrideModalOpen(false);
                      showToast("success", "Override reset to default.");
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Reset All Overrides
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOverrideModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={overrideSaving}
                    onClick={async () => {
                      setOverrideSaving(true);
                      try {
                        const res = await fetch("/api/admin/entry-overrides", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(selectedOverrideItem),
                        });
                        if (res.ok) {
                          clearAllClientCaches();
                          setOverrideModalOpen(false);
                          loadOverrides();
                          showToast("success", "Entry override saved successfully!");
                        } else {
                          const errData = await res.json().catch(() => ({}));
                          showToast("error", errData.error || "Failed to save override");
                        }
                      } catch {
                        showToast("error", "Error saving override");
                      } finally {
                        setOverrideSaving(false);
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                  >
                    {overrideSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>Save Override</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 7: THEME STUDIO & SITE CUSTOMIZATION
  // ─────────────────────────────────────────────────────────────────────────────
  const renderAppearanceTab = () => {
    return (
      <div className="space-y-6">
        {/* Header & Create Theme Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-fuchsia-400" />
              Theme Studio & Custom Themes
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Create real-time custom themes on the fly. Published themes automatically appear in the themes drawer for all visitors.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingTheme({
                id: "",
                label: "",
                tagline: "Custom",
                description: "",
                background: "#080C14",
                card: "#141C2B",
                primary: "#38BDF8",
                accent: "#F43F5E",
                foreground: "#E2E8F0",
                enabled: true,
              });
              setThemeModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:opacity-90 text-white text-xs font-semibold shadow cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Theme</span>
          </button>
        </div>

        {/* Existing Custom Themes List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Active Custom Themes ({adminCustomThemes.length})
            </h4>
          </div>

          {adminThemesLoading ? (
            <div className="py-8 text-center text-xs text-zinc-400 font-medium">
              <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" /> Loading custom themes...
            </div>
          ) : adminCustomThemes.length === 0 ? (
            <div className="p-4 rounded-xl bg-black/40 border border-zinc-800/80 text-center text-xs text-zinc-500 italic">
              No custom themes created yet. Click "Create New Theme" above to build one.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {adminCustomThemes.map((ct) => (
                <div
                  key={ct.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-10 h-10 rounded-xl shrink-0 border border-zinc-700 shadow-sm relative overflow-hidden p-1 flex flex-col justify-between"
                      style={{ backgroundColor: ct.background || "#090E17" }}
                    >
                      <span
                        className="block h-1 w-full rounded-full"
                        style={{ backgroundColor: ct.primary || ct.accent || "#38BDF8" }}
                      />
                      <div
                        className="w-full h-3 rounded opacity-40"
                        style={{ backgroundColor: ct.card || "rgba(255,255,255,0.1)" }}
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white truncate">{ct.label}</span>
                        <span className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded ${ct.enabled ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500"}`}>
                          {ct.enabled ? "Live" : "Off"}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate">{ct.description || "Custom theme"}</p>
                    </div>
                  </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTheme({
                            id: ct.id,
                            label: ct.label,
                            tagline: ct.tagline || "Custom",
                            description: ct.description || "",
                            background: ct.background || "#080C14",
                            card: ct.card || "#141C2B",
                            primary: ct.primary || "#38BDF8",
                            accent: ct.accent || ct.primary || "#F43F5E",
                            foreground: ct.foreground || "#E2E8F0",
                            enabled: ct.enabled ?? true,
                          });
                          setThemeModalOpen(true);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors"
                        title="Edit Custom Theme"
                      >
                        <Sliders className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const res = await fetch("/api/admin/themes", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: ct.id, enabled: !ct.enabled }),
                          });
                          if (res.ok) {
                            loadAdminThemes();
                            refreshCustomThemes();
                            showToast("success", `Theme ${!ct.enabled ? "enabled" : "disabled"}`);
                          }
                        }}
                        className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
                        title="Toggle Live"
                      >
                        {ct.enabled ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-zinc-600" />}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Delete custom theme "${ct.label}"?`)) return;
                          const res = await fetch("/api/admin/themes", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: ct.id }),
                          });
                          if (res.ok) {
                            loadAdminThemes();
                            refreshCustomThemes();
                            showToast("success", "Theme deleted.");
                          }
                        }}
                        className="p-1.5 text-rose-400 hover:text-rose-300 rounded cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Site Branding Tagline */}
        <div className="pt-4 border-t border-zinc-800 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Site Branding & Tagline
          </h4>

          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase">Global Header Tagline</label>
            <input
              type="text"
              value={appearance.tagline}
              onChange={(e) => setAppearance({ ...appearance, tagline: e.target.value })}
              placeholder="e.g. Movies. TV. Anime. All in one place."
              className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs font-medium focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={async () => {
                setAppearanceSaving(true);
                try {
                  const res = await fetch("/api/admin/settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(appearance),
                  });
                  if (res.ok) {
                    showToast("success", "Tagline settings saved!");
                  }
                } finally {
                  setAppearanceSaving(false);
                }
              }}
              disabled={appearanceSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow cursor-pointer disabled:opacity-50"
            >
              {appearanceSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Tagline</span>
            </button>
          </div>
        </div>

        {/* Theme Studio Modal */}
        {themeModalOpen && editingTheme && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden sm:overflow-y-auto">
            <div className="relative w-full max-w-2xl bg-[#0D1117] border-0 sm:border border-zinc-800 rounded-none sm:rounded-2xl shadow-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] max-h-[100dvh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-800 shrink-0 bg-zinc-900/40 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <div className="flex items-center gap-2.5">
                  <Palette className="w-4 h-4 text-fuchsia-400" />
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white">Theme Creator Studio</h3>
                    <p className="text-[11px] sm:text-xs text-zinc-400">Build a custom color palette</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setThemeModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-4 flex-1 min-h-0 px-4 sm:px-6 py-3.5 sm:py-4 custom-scrollbar">
                {/* Name & Tagline */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase">Theme Name</label>
                    <input
                      type="text"
                      value={editingTheme.label}
                      onChange={(e) => setEditingTheme({ ...editingTheme, label: e.target.value })}
                      placeholder="e.g. Cyberpunk Neon"
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs font-semibold focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase">Tagline</label>
                    <input
                      type="text"
                      value={editingTheme.tagline}
                      onChange={(e) => setEditingTheme({ ...editingTheme, tagline: e.target.value })}
                      placeholder="e.g. Neon"
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs font-medium focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Description</label>
                  <input
                    type="text"
                    value={editingTheme.description || ""}
                    onChange={(e) => setEditingTheme({ ...editingTheme, description: e.target.value })}
                    placeholder="e.g. Vibrant cyan and magenta palette with dark obsidian contrast."
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Starter Pack Base Selector */}
                <div className="space-y-2.5 pb-3 border-b border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">Starter Pack Templates</span>
                      <span className="text-[11px] text-zinc-400">Pick a pre-harmonized starter pack base, then customize every detail below</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      {
                        id: "midnight",
                        label: "Neon Midnight",
                        tagline: "Cyberpunk",
                        description: "Sleek dark slate canvas with luminous cyan & fuchsia accents.",
                        background: "#090E17",
                        card: "#131C2E",
                        primary: "#38BDF8",
                        accent: "#F43F5E",
                        foreground: "#F1F5F9",
                        previewGradient: "linear-gradient(135deg, #090E17 0%, #131C2E 50%, #38BDF8 100%)",
                      },
                      {
                        id: "glass",
                        label: "Liquid Glass",
                        tagline: "Frosted",
                        description: "Deep obsidian backdrop with translucent sapphire & ice blue glows.",
                        background: "#080B14",
                        card: "#111827",
                        primary: "#60A5FA",
                        accent: "#38BDF8",
                        foreground: "#F8FAFC",
                        previewGradient: "linear-gradient(135deg, #080B14 0%, #111827 50%, #60A5FA 100%)",
                      },
                      {
                        id: "oled",
                        label: "AMOLED Pitch",
                        tagline: "True Black",
                        description: "Pure pitch black background optimized for OLED displays with vivid contrast.",
                        background: "#000000",
                        card: "#121212",
                        primary: "#10B981",
                        accent: "#34D399",
                        foreground: "#F1F5F9",
                        previewGradient: "linear-gradient(135deg, #000000 0%, #121212 50%, #10B981 100%)",
                      },
                      {
                        id: "velvet",
                        label: "Royal Velvet",
                        tagline: "Luxury",
                        description: "Deep burgundy shadow canvas with warm champagne & brass highlights.",
                        background: "#12050A",
                        card: "#210C14",
                        primary: "#F43F5E",
                        accent: "#F59E0B",
                        foreground: "#FDF2F8",
                        previewGradient: "linear-gradient(135deg, #12050A 0%, #210C14 50%, #F43F5E 100%)",
                      },
                      {
                        id: "forest",
                        label: "Emerald Forest",
                        tagline: "Evergreen",
                        description: "Atmospheric dark evergreen shadow with mint & sage streaming accents.",
                        background: "#060F0B",
                        card: "#112219",
                        primary: "#10B981",
                        accent: "#34D399",
                        foreground: "#F1F5F9",
                        previewGradient: "linear-gradient(135deg, #060F0B 0%, #112219 50%, #10B981 100%)",
                      },
                      {
                        id: "cosmos",
                        label: "Cosmic Space",
                        tagline: "Celestial",
                        description: "Deep cosmic indigo shadow with radiant violet & cyan nebulae.",
                        background: "#090A14",
                        card: "#14172B",
                        primary: "#A855F7",
                        accent: "#06B6D4",
                        foreground: "#F8FAFC",
                        previewGradient: "linear-gradient(135deg, #090A14 0%, #14172B 50%, #A855F7 100%)",
                      },
                    ].map((pack) => {
                      const isSelected = editingTheme.background === pack.background && editingTheme.primary === pack.primary;
                      return (
                        <button
                          key={pack.id}
                          type="button"
                          onClick={() => {
                            setEditingTheme({
                              ...editingTheme,
                              background: pack.background,
                              card: pack.card,
                              primary: pack.primary,
                              accent: pack.accent,
                              foreground: pack.foreground,
                            });
                            previewCustomTheme({
                              ...editingTheme,
                              background: pack.background,
                              card: pack.card,
                              primary: pack.primary,
                              accent: pack.accent,
                              foreground: pack.foreground,
                            });
                          }}
                          className={`flex flex-col text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "border-primary bg-primary/10 shadow-sm"
                              : "border-zinc-800 bg-black/40 hover:border-zinc-700"
                          }`}
                        >
                          <div
                            className="w-full h-8 rounded-lg mb-2 shadow-inner"
                            style={{ background: pack.previewGradient }}
                          />
                          <span className="text-xs font-bold text-white truncate">{pack.label}</span>
                          <span className="text-[10px] text-zinc-400">{pack.tagline}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Individual Color Pickers */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-white block">Fine-Tune Color Tokens</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                      <div>
                        <span className="text-xs font-semibold text-white block">Canvas Background</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{editingTheme.background}</span>
                      </div>
                      <input
                        type="color"
                        value={editingTheme.background}
                        onChange={(e) => {
                          const updated = { ...editingTheme, background: e.target.value };
                          setEditingTheme(updated);
                          previewCustomTheme(updated);
                        }}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                      <div>
                        <span className="text-xs font-semibold text-white block">Card & Sidebar Tiles</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{editingTheme.card}</span>
                      </div>
                      <input
                        type="color"
                        value={editingTheme.card}
                        onChange={(e) => {
                          const updated = { ...editingTheme, card: e.target.value };
                          setEditingTheme(updated);
                          previewCustomTheme(updated);
                        }}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                      <div>
                        <span className="text-xs font-semibold text-white block">Primary Accent</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{editingTheme.primary}</span>
                      </div>
                      <input
                        type="color"
                        value={editingTheme.primary}
                        onChange={(e) => {
                          const updated = { ...editingTheme, primary: e.target.value };
                          setEditingTheme(updated);
                          previewCustomTheme(updated);
                        }}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                      <div>
                        <span className="text-xs font-semibold text-white block">Secondary Glow</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{editingTheme.accent}</span>
                      </div>
                      <input
                        type="color"
                        value={editingTheme.accent}
                        onChange={(e) => {
                          const updated = { ...editingTheme, accent: e.target.value };
                          setEditingTheme(updated);
                          previewCustomTheme(updated);
                        }}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Sticky Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-zinc-800 bg-[#0D1117] shrink-0 sticky bottom-0 z-10 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => {
                    previewCustomTheme(editingTheme);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer border border-zinc-700/80 transition-colors"
                >
                  <Eye className="w-4 h-4 text-sky-400" />
                  <span>Live Preview</span>
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setThemeModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!editingTheme.label?.trim()) {
                        showToast("error", "Theme name is required");
                        return;
                      }
                      const method = editingTheme.id ? "PUT" : "POST";
                      const res = await fetch("/api/admin/themes", {
                        method,
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(editingTheme),
                      });
                      if (res.ok) {
                        setThemeModalOpen(false);
                        previewCustomTheme(null);
                        loadAdminThemes();
                        refreshCustomThemes();
                        showToast("success", `Custom theme "${editingTheme.label}" ${editingTheme.id ? "updated" : "published"}!`);
                      } else {
                        showToast("error", "Failed to save theme");
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:opacity-95 text-white text-xs font-semibold shadow cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingTheme.id ? "Update Theme Live" : "Publish Theme Live"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 8: ISSUE REPORTS
  // ─────────────────────────────────────────────────────────────────────────────
  const renderReportsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">User Bug & Issue Reports</h3>
          <p className="text-xs text-zinc-400">Database-backed bug submissions from users. Review, resolve, or delete reports.</p>
        </div>
        <button
          type="button"
          onClick={loadReports}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer border border-zinc-700/80 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${reportsLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {reportsLoading ? (
        <div className="py-12 text-center text-xs text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading issue reports...
        </div>
      ) : reportsList.length === 0 ? (
        <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center text-xs text-zinc-500">
          No issue reports found. Submissions from /contact will appear here.
        </div>
      ) : (
        <div className="space-y-3">
          {reportsList.map((rep: any) => {
            const isResolved = rep.status === "resolved";
            return (
              <div key={rep.id} className={`p-4 rounded-2xl border transition-all ${
                isResolved ? "bg-zinc-950/40 border-zinc-800/60 opacity-60" : "bg-zinc-900/60 border-zinc-800"
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold ${isResolved ? "line-through text-zinc-400" : "text-amber-300"}`}>
                      {rep.topic}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {rep.userEmail || "user"}
                    </span>
                    <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded border ${
                      isResolved
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}>
                      {rep.status || "open"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        const newStatus = isResolved ? "open" : "resolved";
                        const res = await fetch("/api/contact", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: rep.id, status: newStatus }),
                        });
                        if (res.ok) {
                          loadReports();
                          showToast("success", `Report marked as ${newStatus}`);
                        }
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 ${isResolved ? "text-emerald-400" : "text-zinc-400"}`} />
                      <span>{isResolved ? "Reopen" : "Mark Done"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete bug report "${rep.topic}"?`)) return;
                        const res = await fetch("/api/contact", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: rep.id }),
                        });
                        if (res.ok) {
                          loadReports();
                          showToast("success", "Report deleted");
                        }
                      }}
                      className="p-1 text-rose-400 hover:text-rose-300 rounded cursor-pointer transition-colors"
                      title="Delete Report"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed bg-black/40 p-3 rounded-xl border border-zinc-800/80">
                  {rep.message}
                </p>

                <div className="mt-2 text-[10px] font-mono text-zinc-500 text-right">
                  {new Date(rep.createdAt).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderStreamingTab = () => {
    const SOURCE_LABELS: Record<string, string> = {
      animeplay: "AnimePlay",
      vidnest: "VidNest",
      embedmaster: "EmbedMaster",
      animepahe: "AnimePahe",
      animesub: "AnimeSub",
      vidsrc: "Vidsrc",
      vixsrc: "Vixsrc",
      videasy: "Videasy",
      vidlink: "Vidlink",
      autoembed: "AutoEmbed",
      "123embed": "123Embed",
    };

    const renderCategory = (category: "movie" | "anime", title: string, description: string) => {
      const list = streamingConfig[category] || [];
      return (
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wide">{title}</h4>
                <p className="text-[10px] text-zinc-400 mt-0.5">{description}</p>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">{list.length} sources</span>
            </div>
          </div>

          {list.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">No sources configured.</div>
          ) : (
            <div className="p-2.5 space-y-1.5">
              {list.map((entry, index) => (
                <div
                  key={entry.key}
                  draggable
                  onDragStart={() => setStreamingDrag({ category, index })}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!streamingDrag || streamingDrag.category !== category || streamingDrag.index === index) {
                      setStreamingDrag(null);
                      return;
                    }
                    moveStreamingSource(category, streamingDrag.index, index);
                    setStreamingDrag(null);
                  }}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                    streamingDrag?.category === category && streamingDrag.index === index
                      ? "bg-sky-500/10 border-sky-500/60 opacity-60"
                      : "bg-zinc-950/40 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-zinc-500 shrink-0 cursor-grab active:cursor-grabbing hidden sm:block" />

                  <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-lg bg-zinc-800 text-[10px] font-mono text-zinc-400">
                    {index + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-zinc-200 truncate">{SOURCE_LABELS[entry.key] || entry.key}</span>
                    </div>
                  </div>

                  <select
                    value={entry.tag}
                    onChange={(e) => updateStreamingTag(category, index, e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-200 font-semibold cursor-pointer focus:outline-none focus:border-zinc-500"
                  >
                    {SOURCE_TAGS.map((tag) => (
                      <option key={tag} value={tag}>{SOURCE_TAG_LABELS[tag]}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveStreamingSource(category, index, index - 1)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      aria-label="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === list.length - 1}
                      onClick={() => moveStreamingSource(category, index, index + 1)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      aria-label="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-white">Streaming Sources</h3>
            <p className="text-xs text-zinc-400">Reorder and tag playback sources. Saves apply to new page loads without interrupting active viewers.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadStreaming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer border border-zinc-700/80 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${streamingLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={resetStreaming}
              disabled={streamingSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold cursor-pointer border border-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset to Default</span>
            </button>
            <button
              type="button"
              onClick={saveStreaming}
              disabled={streamingSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold cursor-pointer border border-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {streamingSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{streamingSaving ? "Saving..." : "Save Order"}</span>
            </button>
          </div>
        </div>

        <p className="text-[10px] text-zinc-500 font-mono">*Drag items or use the arrow buttons to reorder. Use the dropdown to set a status tag for each source.</p>

        {streamingLoading ? (
          <div className="py-12 text-center text-xs text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading streaming sources...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {renderCategory(
              "movie",
              "Movies & TV Shows",
              "Used by the movie and TV detail page players"
            )}
            {renderCategory(
              "anime",
              "Anime",
              "Used by the anime player"
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {renderPreviewBanner()}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 overflow-hidden sm:overflow-y-auto">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
          onClick={onClose}
        />

        {/* Main Modal Shell */}
        <div 
          className="relative w-full max-w-5xl bg-[#090D16] border-0 sm:border border-zinc-800 rounded-none sm:rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] max-h-[100dvh]"
          role="dialog"
          aria-modal="true"
        >
          {/* Modal Top Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-800 bg-zinc-900/40 shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-lg font-bold text-white tracking-tight truncate">
                    CineStream Admin Console
                  </h2>
                  <span className="text-[9px] sm:text-[10px] uppercase font-mono px-1.5 sm:px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                    Admin
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-zinc-400 truncate hidden sm:block">Database-driven management & platform controls</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body with Sidebar Tabs + Content Area */}
          <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
            {/* Left Tab Navigation */}
            <div className="w-full md:w-56 lg:w-60 bg-zinc-950/60 border-b md:border-b-0 md:border-r border-zinc-800 p-2 sm:p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto shrink-0 custom-scrollbar flex-nowrap scroll-smooth touch-pan-x">
              {[
                { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                { id: "announcements", label: "Announcements", icon: Megaphone, badge: currentAnnouncement ? "Live" : null },
                { id: "sections", label: "Custom Rows", icon: Film },
                { id: "spotlight", label: "Spotlight Hero", icon: Star },
                { id: "users", label: "User Accounts", icon: Users },
                { id: "franchises", label: "Franchises", icon: Layers },
                { id: "overrides", label: "Entry Overrides", icon: Sliders, badge: overridesList.length > 0 ? String(overridesList.length) : null },
                { id: "appearance", label: "Theme Studio", icon: Palette },
                { id: "reports", label: "Issue Reports", icon: Bug, badge: reportsList.length > 0 ? String(reportsList.length) : null },
                { id: "streaming", label: "Sources", icon: Server },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as AdminTab)}
                    className={`flex items-center justify-between gap-2.5 sm:gap-3 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 md:w-full ${
                      isActive
                        ? "bg-zinc-800 text-white border border-zinc-700/80 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-zinc-400"}`} />
                      <span>{tab.label}</span>
                    </div>

                    {tab.badge && (
                      <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Content Panel */}
            <div className="flex-1 min-h-0 p-3.5 sm:p-6 overflow-y-auto custom-scrollbar bg-black/20 overscroll-contain">
              {activeTab === "dashboard" && renderDashboardTab()}
              {activeTab === "announcements" && renderAnnouncementsTab()}
              {activeTab === "sections" && renderSectionsTab()}
              {activeTab === "spotlight" && renderSpotlightTab()}
              {activeTab === "users" && renderUsersTab()}
              {activeTab === "franchises" && renderFranchisesTab()}
              {activeTab === "overrides" && renderOverridesTab()}
              {activeTab === "appearance" && renderAppearanceTab()}
              {activeTab === "reports" && renderReportsTab()}
              {activeTab === "streaming" && renderStreamingTab()}

              {/* Feedback Toast Notification */}
              {statusMessage && (
                <div className={`mt-4 flex items-center gap-2 p-3.5 rounded-2xl text-xs font-medium animate-fade-in ${
                  statusMessage.type === "success" 
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                }`}>
                  {statusMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{statusMessage.text}</span>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 border-t border-zinc-800 bg-zinc-900/40 text-[10px] sm:text-[11px] text-zinc-500 shrink-0 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
            <span className="truncate">Database-verified administrator console</span>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 sm:px-3 py-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              Close Console
            </button>
          </div>
        </div>
      </div>
    </>
  );
});
