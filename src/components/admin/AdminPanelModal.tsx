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
} from "lucide-react";
import { useAnnouncement } from "@/hooks/useAnnouncement";
import { useTheme } from "@/context/ThemeContext";
import { harmonizeAccentToCineStreamTheme, ArchetypeStyle } from "@/lib/themes";

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
  | "appearance"
  | "reports";

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

  // ── Franchises State ──
  const [customFranchisesList, setCustomFranchisesList] = useState<any[]>([]);
  const [franchisesLoading, setFranchisesLoading] = useState(false);
  const [editingFranchise, setEditingFranchise] = useState<any | null>(null);
  const [franchiseModalOpen, setFranchiseModalOpen] = useState(false);

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

  // ── Media Picker State (Used for Sections, Franchises, Spotlight) ──
  const [pickerSearchQuery, setPickerSearchQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<any[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const showToast = (type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
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
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setUsersList(json.users || []);
          if (json.currentUserId) setCurrentAdminId(json.currentUserId);
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

  // Load data when active tab changes
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "dashboard") loadStats();
    if (activeTab === "sections") loadSections();
    if (activeTab === "spotlight") loadSpotlight();
    if (activeTab === "users") loadUsers(userQuery);
    if (activeTab === "franchises") loadFranchises();
    if (activeTab === "reports") loadReports();
    if (activeTab === "appearance") {
      loadAppearance();
      loadAdminThemes();
    }
  }, [isOpen, activeTab, loadStats, loadSections, loadSpotlight, loadUsers, loadFranchises, loadReports, loadAppearance, loadAdminThemes, userQuery]);

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
      <div className="fixed top-0 inset-x-0 z-[100] bg-zinc-950/95 border-b border-amber-500/30 backdrop-blur-xl px-4 py-2.5 flex items-center justify-between shadow-2xl animate-fade-in-up">
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
                      body: JSON.stringify({ section: { ...sec, enabled: !sec.enabled } }),
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl bg-[#0D1117] border border-zinc-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">
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

            <div className="overflow-y-auto space-y-4 flex-1 pr-1 custom-scrollbar">
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-black/50 border border-zinc-800/80 custom-scrollbar">
                    {pickerResults.map((item) => (
                      <div
                        key={`${item.media_type}_${item.id}`}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {item.poster_path && <img src={item.poster_path} alt="" className="w-6 h-8 object-cover rounded shrink-0" />}
                          <p className="text-[11px] font-semibold text-zinc-200 truncate">{item.title}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const current = Array.isArray(editingSection.items) ? editingSection.items : [];
                            setEditingSection({ ...editingSection, items: [...current, item] });
                            showToast("success", `Added ${item.title}`);
                          }}
                          className="p-1 rounded bg-primary text-primary-foreground cursor-pointer shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Items in Section */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <label className="text-xs font-semibold text-zinc-400 uppercase">
                  Titles in Row ({editingSection.items?.length || 0})
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {editingSection.items?.map((it: any, itemIdx: number) => (
                    <div key={itemIdx} className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
                      <span className="text-xs font-semibold text-zinc-200 truncate">{it.title || it.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newItems = editingSection.items.filter((_: any, i: number) => i !== itemIdx);
                          setEditingSection({ ...editingSection, items: newItems });
                        }}
                        className="text-rose-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
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
                  const res = await fetch("/api/admin/home-sections", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ section: editingSection }),
                  });
                  if (res.ok) {
                    setSectionModalOpen(false);
                    loadSections();
                    showToast("success", "Custom row saved!");
                  } else {
                    showToast("error", "Failed to save section");
                  }
                }}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow cursor-pointer"
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
          {usersList.map((u) => {
            const isSelf = u.id === currentAdminId;
            const isSuperAdmin = u.email?.toLowerCase() === "asifraffy@gmail.com";
            const isAdmin = u.role === "admin";
            const isDisabled = u.status === "disabled";

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
                      {isSuperAdmin ? (
                        <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Super Admin
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
                    <p className="text-[11px] text-zinc-400 truncate">{u.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {isSuperAdmin ? (
                    <span className="text-[11px] font-medium text-amber-400 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      Fixed Super Admin
                    </span>
                  ) : (
                    <>
                      {/* Toggle Admin Role */}
                      {!isSelf && (
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

                      {/* Toggle Account Status */}
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={async () => {
                            const newStatus = isDisabled ? "active" : "disabled";
                            const res = await fetch("/api/admin/users", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ userId: u.id, status: newStatus }),
                            });
                            if (res.ok) {
                              loadUsers(userQuery);
                              showToast("success", `Account ${newStatus === "active" ? "enabled" : "disabled"}`);
                            } else {
                              const errData = await res.json().catch(() => ({}));
                              showToast("error", errData.error || "Failed to update status");
                            }
                          }}
                          className="p-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                          title={isDisabled ? "Enable Account" : "Disable Account"}
                        >
                          {isDisabled ? <ToggleLeft className="w-5 h-5 text-rose-400" /> : <ToggleRight className="w-5 h-5 text-emerald-400" />}
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
  const renderFranchisesTab = () => (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            Dynamic Franchises & Collections
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Build custom collections (e.g. "Best Anime Movies", "Spider-Man Saga") rendered on the Franchises page.
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
          <span>New Collection</span>
        </button>
      </div>

      {franchisesLoading ? (
        <div className="flex items-center justify-center py-16 text-zinc-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-xs font-medium">Loading collections...</span>
        </div>
      ) : customFranchisesList.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-black/40 border border-zinc-800/80 space-y-3">
          <Layers className="w-10 h-10 mx-auto text-zinc-600" />
          <p className="text-sm font-semibold text-zinc-300">No dynamic collections created yet</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Create collections without code edits. They automatically render on `/browse/franchises`.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {customFranchisesList.map((col) => (
            <div
              key={col.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                {col.posterPath ? (
                  <img src={col.posterPath} alt="" className="w-10 h-14 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-10 h-14 bg-zinc-800 rounded-lg flex items-center justify-center text-[10px] text-zinc-500">No img</div>
                )}
                <div>
                  <h4 className="text-sm font-bold text-white">{col.name}</h4>
                  <p className="text-xs text-zinc-400 line-clamp-1">{col.overview || "No description"}</p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {Array.isArray(col.parts) ? col.parts.length : 0} items in collection
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
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
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Delete collection "${col.name}"?`)) return;
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
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Franchise Editor Modal */}
      {franchiseModalOpen && editingFranchise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl bg-[#0D1117] border border-zinc-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">
                {editingFranchise.id ? "Edit Franchise Collection" : "Create Franchise Collection"}
              </h3>
              <button
                type="button"
                onClick={() => setFranchiseModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1 pr-1 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Collection Name</label>
                  <input
                    type="text"
                    value={editingFranchise.name}
                    onChange={(e) => setEditingFranchise({ ...editingFranchise, name: e.target.value })}
                    placeholder="e.g. Best Anime Movies"
                    className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs font-semibold focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Poster Image URL</label>
                  <input
                    type="text"
                    value={editingFranchise.posterPath || ""}
                    onChange={(e) => setEditingFranchise({ ...editingFranchise, posterPath: e.target.value })}
                    placeholder="https://..."
                    className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase">Overview</label>
                <textarea
                  rows={2}
                  value={editingFranchise.overview || ""}
                  onChange={(e) => setEditingFranchise({ ...editingFranchise, overview: e.target.value })}
                  placeholder="e.g. A handpicked collection of acclaimed theatrical films..."
                  className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Media Picker */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <label className="text-xs font-semibold text-zinc-400 uppercase flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-sky-400" />
                  Search & Add Entries
                </label>
                <input
                  type="text"
                  value={pickerSearchQuery}
                  onChange={(e) => {
                    setPickerSearchQuery(e.target.value);
                    searchMediaItems(e.target.value);
                  }}
                  placeholder="Search titles..."
                  className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-zinc-800 text-white text-xs focus:outline-none focus:border-primary"
                />

                {pickerResults.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 rounded-xl bg-black/50 border border-zinc-800/80 custom-scrollbar">
                    {pickerResults.map((item) => (
                      <div
                        key={`${item.media_type}_${item.id}`}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {item.poster_path && <img src={item.poster_path} alt="" className="w-6 h-8 object-cover rounded" />}
                          <p className="text-[11px] font-semibold text-zinc-200 truncate">{item.title}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const current = Array.isArray(editingFranchise.parts) ? editingFranchise.parts : [];
                            setEditingFranchise({ ...editingFranchise, parts: [...current, item] });
                            if (!editingFranchise.posterPath && item.poster_path) {
                              setEditingFranchise((prev: any) => ({ ...prev, posterPath: item.poster_path, backdropPath: item.backdrop_path }));
                            }
                            showToast("success", `Added ${item.title}`);
                          }}
                          className="p-1 rounded bg-primary text-primary-foreground cursor-pointer shrink-0"
                        >
                          <Plus className="w-3 h-3" />
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {editingFranchise.parts?.map((pt: any, ptIdx: number) => (
                    <div key={ptIdx} className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
                      <span className="text-xs font-semibold text-zinc-200 truncate">{pt.title || pt.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newParts = editingFranchise.parts.filter((_: any, i: number) => i !== ptIdx);
                          setEditingFranchise({ ...editingFranchise, parts: newParts });
                        }}
                        className="text-rose-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
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
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Collection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 7: THEME STUDIO & SITE CUSTOMIZATION
  // ─────────────────────────────────────────────────────────────────────────────
  const renderAppearanceTab = () => {
    const previewGradient = `linear-gradient(135deg, ${editingTheme.background} 0%, ${editingTheme.card} 45%, ${editingTheme.primary} 85%, ${editingTheme.accent} 100%)`;

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
                      className="w-10 h-10 rounded-xl shrink-0 border border-zinc-700 shadow-sm"
                      style={{ background: ct.preview || `linear-gradient(135deg, ${ct.background} 0%, ${ct.card} 50%, ${ct.primary} 100%)` }}
                    />
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl bg-[#0D1117] border border-zinc-800 rounded-2xl p-6 shadow-2xl max-h-[92vh] flex flex-col space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <Palette className="w-4 h-4 text-fuchsia-400" />
                  <div>
                    <h3 className="text-base font-bold text-white">Theme Creator Studio</h3>
                    <p className="text-xs text-zinc-400">Build a custom color palette</p>
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

              <div className="overflow-y-auto space-y-4 flex-1 pr-1 custom-scrollbar">
                {/* Live Preview Card */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <Eye className="w-3 h-3 text-fuchsia-400" />
                    Live Palette Preview
                  </span>
                  <div
                    className="relative overflow-hidden rounded-2xl border border-white/10 p-4 shadow-md"
                    style={{ background: previewGradient }}
                  >
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow" style={{ backgroundColor: editingTheme.primary, color: "#000" }}>
                        {editingTheme.tagline || "Custom"}
                      </span>
                      <span className="text-[11px] font-semibold" style={{ color: editingTheme.foreground }}>
                        {editingTheme.label || "Theme Title"}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-white/10 flex items-center justify-between" style={{ backgroundColor: editingTheme.card }}>
                      <div className="space-y-1">
                        <div className="w-24 h-2 rounded bg-white/40" />
                        <div className="w-16 h-1.5 rounded bg-white/20" />
                      </div>
                      <button
                        type="button"
                        className="px-3 py-1 rounded-lg text-[10px] font-semibold shadow"
                        style={{ backgroundColor: editingTheme.primary, color: "#000" }}
                      >
                        Watch Now
                      </button>
                    </div>
                  </div>
                </div>

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
                    <button
                      type="button"
                      onClick={() => {
                        const harmonized = harmonizeAccentToCineStreamTheme(editingTheme.primary || "#38BDF8", "midnight");
                        setEditingTheme({
                          ...editingTheme,
                          ...harmonized,
                        });
                        showToast("success", "Auto-harmonized current accent color!");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Auto-Tune Accent</span>
                    </button>
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
                              label: editingTheme.id ? editingTheme.label : pack.label,
                              tagline: editingTheme.id ? editingTheme.tagline : pack.tagline,
                              description: editingTheme.id ? editingTheme.description : pack.description,
                              background: pack.background,
                              card: pack.card,
                              primary: pack.primary,
                              accent: pack.accent,
                              foreground: pack.foreground,
                            });
                            showToast("success", `Loaded ${pack.label} starter pack!`);
                          }}
                          className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer group ${
                            isSelected
                              ? "bg-fuchsia-500/10 border-fuchsia-500/40 text-white shadow-sm"
                              : "bg-black/40 hover:bg-zinc-800/80 border-zinc-800 text-zinc-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1 w-full">
                            <span className="w-3 h-3 rounded-full border border-white/20 shrink-0" style={{ background: pack.previewGradient }} />
                            <span className="text-xs font-bold truncate group-hover:text-white transition-colors">{pack.label}</span>
                          </div>
                          <span className="text-[10px] text-zinc-400 truncate w-full">{pack.tagline}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color Pickers */}
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <span className="text-xs font-semibold text-zinc-400 uppercase block">Fine-Tune Color Controls</span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                      <div>
                        <span className="text-xs font-semibold text-white block">Background</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{editingTheme.background}</span>
                      </div>
                      <input
                        type="color"
                        value={editingTheme.background}
                        onChange={(e) => setEditingTheme({ ...editingTheme, background: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                      <div>
                        <span className="text-xs font-semibold text-white block">Card / Surface</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{editingTheme.card}</span>
                      </div>
                      <input
                        type="color"
                        value={editingTheme.card}
                        onChange={(e) => setEditingTheme({ ...editingTheme, card: e.target.value })}
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
                        onChange={(e) => setEditingTheme({ ...editingTheme, primary: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                      <div>
                        <span className="text-xs font-semibold text-white block">Secondary Accent</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{editingTheme.accent}</span>
                      </div>
                      <input
                        type="color"
                        value={editingTheme.accent}
                        onChange={(e) => setEditingTheme({ ...editingTheme, accent: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-zinc-800 sm:col-span-2">
                      <div>
                        <span className="text-xs font-semibold text-white block">Text / Foreground</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{editingTheme.foreground}</span>
                      </div>
                      <input
                        type="color"
                        value={editingTheme.foreground}
                        onChange={(e) => setEditingTheme({ ...editingTheme, foreground: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    previewCustomTheme(editingTheme);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer border border-zinc-700/80 transition-colors"
                >
                  <Eye className="w-4 h-4 text-sky-400" />
                  <span>Live Site Preview</span>
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

  return (
    <>
      {renderPreviewBanner()}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
          onClick={onClose}
        />

        {/* Main Modal Shell */}
        <div 
          className="relative w-full max-w-5xl bg-[#090D16] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col my-auto max-h-[92vh]"
          role="dialog"
          aria-modal="true"
        >
          {/* Modal Top Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    CineStream Admin Console
                  </h2>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Admin
                  </span>
                </div>
                <p className="text-xs text-zinc-400">Database-driven management & platform controls</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body with Sidebar Tabs + Content Area */}
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* Left Tab Navigation */}
            <div className="w-full md:w-56 lg:w-60 bg-zinc-950/60 border-b md:border-b-0 md:border-r border-zinc-800 p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto shrink-0 custom-scrollbar">
              {[
                { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                { id: "announcements", label: "Announcements", icon: Megaphone, badge: currentAnnouncement ? "Live" : null },
                { id: "sections", label: "Custom Rows", icon: Film },
                { id: "spotlight", label: "Spotlight Hero", icon: Star },
                { id: "users", label: "User Accounts", icon: Users },
                { id: "franchises", label: "Franchises", icon: Layers },
                { id: "appearance", label: "Theme Studio", icon: Palette },
                { id: "reports", label: "Issue Reports", icon: Bug, badge: reportsList.length > 0 ? String(reportsList.length) : null },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as AdminTab)}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 md:w-full ${
                      isActive
                        ? "bg-zinc-800 text-white border border-zinc-700/80 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
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
            <div className="flex-1 p-5 sm:p-6 overflow-y-auto custom-scrollbar bg-black/20">
              {activeTab === "dashboard" && renderDashboardTab()}
              {activeTab === "announcements" && renderAnnouncementsTab()}
              {activeTab === "sections" && renderSectionsTab()}
              {activeTab === "spotlight" && renderSpotlightTab()}
              {activeTab === "users" && renderUsersTab()}
              {activeTab === "franchises" && renderFranchisesTab()}
              {activeTab === "appearance" && renderAppearanceTab()}
              {activeTab === "reports" && renderReportsTab()}

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
          <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800 bg-zinc-900/40 text-[11px] text-zinc-500">
            <span>Database-verified administrator console</span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Close Console
            </button>
          </div>
        </div>
      </div>
    </>
  );
});
