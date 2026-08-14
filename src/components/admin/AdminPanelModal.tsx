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
  Tv,
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
  ExternalLink,
  RefreshCw,
  Clock,
  Flame,
  ChevronRight,
  Info,
  Sliders,
  Check
} from "lucide-react";
import { useAnnouncement } from "@/hooks/useAnnouncement";
import { useTheme } from "@/context/ThemeContext";

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AdminTab = 
  | "dashboard" 
  | "announcements" 
  | "sections" 
  | "spotlight" 
  | "users" 
  | "franchises" 
  | "appearance";

export const AdminPanelModal = memo(function AdminPanelModal({ isOpen, onClose }: AdminPanelModalProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { refreshCustomThemes } = useTheme();

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

  // Load Custom Themes
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

  // Load Appearance
  const loadAppearance = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.settings) setAppearance(json.settings);
      }
    } catch {}
  }, []);

  // Fetch tab data on tab switch
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "dashboard") loadStats();
    if (activeTab === "sections") loadSections();
    if (activeTab === "spotlight") loadSpotlight();
    if (activeTab === "users") loadUsers(userQuery);
    if (activeTab === "franchises") loadFranchises();
    if (activeTab === "appearance") {
      loadAppearance();
      loadAdminThemes();
    }
  }, [isOpen, activeTab, loadStats, loadSections, loadSpotlight, loadUsers, loadFranchises, loadAppearance, loadAdminThemes, userQuery]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // ── Unified Media Search for Item Picker ──
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

  if (!isOpen) return null;

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 1: DASHBOARD OVERVIEW
  // ─────────────────────────────────────────────────────────────────────────────
  const renderDashboardTab = () => (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1b2333] via-[#141b29] to-[#0d121c] p-5 sm:p-6 border border-white/15 shadow-xl">
        <div className="absolute right-0 top-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Admin Console
              </span>
              <span className="text-xs text-white/50 font-medium">CineStream v2.0</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Control Center & Live Analytics
            </h3>
            <p className="text-xs sm:text-sm text-white/60 mt-1 max-w-xl">
              Manage real-time hero announcements, curated homepage rows, user database roles, spotlight promotions, dynamic franchises, and custom themes.
            </p>
          </div>

          <button
            type="button"
            onClick={loadStats}
            className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/10 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
          <div className="flex items-center justify-between text-white/50 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Users</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white">
            {stats?.users?.total ?? "..."}
          </p>
          <p className="text-[11px] text-white/40 mt-1">
            {stats?.users?.admins ?? 0} Admins · {stats?.users?.regular ?? 0} Users
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
          <div className="flex items-center justify-between text-white/50 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Today</span>
            <Flame className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400">
            {stats?.users?.activeNow ?? "..."}
          </p>
          <p className="text-[11px] text-white/40 mt-1">Active within last 24h</p>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
          <div className="flex items-center justify-between text-white/50 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Home Sections</span>
            <Film className="w-4 h-4 text-fuchsia-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white">
            {stats?.catalog?.enabledCustomSections ?? 0}
          </p>
          <p className="text-[11px] text-white/40 mt-1">
            {stats?.catalog?.customSections ?? 0} total custom rows
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
          <div className="flex items-center justify-between text-white/50 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Franchises</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white">
            {stats?.catalog?.totalFranchises ?? "..."}
          </p>
          <p className="text-[11px] text-white/40 mt-1">
            {stats?.catalog?.customFranchises ?? 0} dynamic collections
          </p>
        </div>
      </div>

      {/* Quick Status & Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Features Status */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-white/70 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Live Features Status
          </h4>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5">
              <div className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-full ${stats?.features?.announcementActive ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
                <span className="text-xs font-bold text-white">Hero Announcement</span>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${stats?.features?.announcementActive ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-white/5 text-white/40"}`}>
                {stats?.features?.announcementActive ? "Active" : "Disabled"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5">
              <div className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-full ${stats?.features?.spotlightActive ? "bg-amber-400 animate-pulse" : "bg-white/20"}`} />
                <span className="text-xs font-bold text-white">Spotlight Hero Banner</span>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${stats?.features?.spotlightActive ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-white/5 text-white/40"}`}>
                {stats?.features?.spotlightActive ? "Enabled" : "Disabled (3-card auto)"}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-white/70 flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-sky-400" />
            Quick Admin Actions
          </h4>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("sections")}
              className="flex items-center gap-2 p-3 rounded-xl bg-black/30 hover:bg-white/10 border border-white/5 text-white font-bold transition-all cursor-pointer text-left"
            >
              <Film className="w-4 h-4 text-fuchsia-400 shrink-0" />
              <span className="truncate">Add Home Row</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("appearance")}
              className="flex items-center gap-2 p-3 rounded-xl bg-black/30 hover:bg-white/10 border border-white/5 text-white font-bold transition-all cursor-pointer text-left"
            >
              <Palette className="w-4 h-4 text-fuchsia-400 shrink-0" />
              <span className="truncate">Theme Studio</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("users")}
              className="flex items-center gap-2 p-3 rounded-xl bg-black/30 hover:bg-white/10 border border-white/5 text-white font-bold transition-all cursor-pointer text-left"
            >
              <Users className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="truncate">Manage Users</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("franchises")}
              className="flex items-center gap-2 p-3 rounded-xl bg-black/30 hover:bg-white/10 border border-white/5 text-white font-bold transition-all cursor-pointer text-left"
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
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
        <div className="flex items-center gap-2.5">
          <div className={`w-3 h-3 rounded-full ${currentAnnouncement ? "bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" : "bg-white/30"}`} />
          <div>
            <p className="text-xs sm:text-sm font-bold text-white">
              Status: {currentAnnouncement ? <span className="text-emerald-400">Active Live on Hero</span> : <span className="text-white/50">No Active Announcement</span>}
            </p>
            {annUpdatedAt && (
              <p className="text-[10px] text-white/40">
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
                showToast("success", "Announcement cleared live from the site.");
              } else {
                showToast("error", res.error || "Failed to clear.");
              }
            }}
            disabled={annSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 rounded-lg border border-rose-500/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Announcement</span>
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="ann-input" className="text-xs font-bold uppercase tracking-wider text-white/70">
            Announcement Message
          </label>
          <span className={`text-[11px] font-medium ${annInputText.length > 250 ? "text-amber-400" : "text-white/40"}`}>
            {annInputText.length} / 300 characters
          </span>
        </div>

        <textarea
          id="ann-input"
          rows={3}
          maxLength={300}
          value={annInputText}
          onChange={(e) => setAnnInputText(e.target.value)}
          placeholder="e.g. New season episodes of Demon Slayer & Solo Leveling are now streaming in 4K!"
          className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/15 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-[#7288AE] focus:ring-1 focus:ring-[#7288AE] transition-all resize-none font-medium leading-relaxed"
        />
        <p className="text-[11px] text-white/40">
          This message broadcasts in real time to all connected visitors without requiring page refresh.
        </p>
      </div>

      {/* Live Preview */}
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-white/60 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-[#7288AE]" />
          Hero Banner Preview
        </span>
        <div className="relative rounded-2xl bg-gradient-to-r from-[#141b27] to-[#0d121c] p-4 border border-white/10 min-h-[90px] flex items-center">
          {annInputText.trim().length > 0 ? (
            <div className="flex items-start gap-3 rounded-xl bg-[#0F141C]/90 border border-white/15 backdrop-blur-md px-3.5 py-2.5 shadow-lg max-w-full">
              <div className="shrink-0 mt-0.5 flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 border border-white/20 text-[#A3B3CC]">
                <Megaphone className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#7288AE] block">
                  Announcement
                </span>
                <p className="text-xs text-[#EAE0CF] font-medium leading-snug break-words">
                  {annInputText.trim()}
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full text-center py-3 text-xs text-white/30 italic">
              No text entered — announcement badge will be hidden on the home hero.
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={async () => {
            setAnnSaving(true);
            const res = await saveAnnouncement(annInputText);
            setAnnSaving(false);
            if (res.success) {
              showToast("success", annInputText.trim() ? "Announcement published live!" : "Announcement cleared.");
            } else {
              showToast("error", res.error || "Failed to save.");
            }
          }}
          disabled={annSaving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#4B5694] hover:bg-[#5b68b0] text-white text-xs font-extrabold transition-all shadow-lg cursor-pointer disabled:opacity-50"
        >
          {annSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save Announcement</span>
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 3: CUSTOM HOMEPAGE SECTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  const renderSectionsTab = () => (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Film className="w-4 h-4 text-fuchsia-400" />
            Curated Homepage Rows
          </h3>
          <p className="text-xs text-white/50">
            Create dynamic sections (e.g. "🎬 Weekend Picks", "🍿 Staff Favorites", "Anime Must-Watches") and pick the exact media to display.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingSection({
              id: "",
              title: "",
              subtitle: "",
              enabled: true,
              orderIndex: sections.length,
              items: [],
            });
            setSectionModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-extrabold transition-all shadow-md cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Section</span>
        </button>
      </div>

      {sectionsLoading ? (
        <div className="flex items-center justify-center py-16 text-white/40">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-xs font-bold">Loading sections...</span>
        </div>
      ) : sections.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-black/20 border border-white/5 space-y-3">
          <Film className="w-10 h-10 mx-auto text-white/20" />
          <p className="text-sm font-bold text-white/60">No custom homepage sections yet</p>
          <p className="text-xs text-white/40 max-w-sm mx-auto">
            Click "New Section" above to create your first curated row for the homepage.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((sec) => (
            <div
              key={sec.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-white/5 text-white/60 mt-0.5">
                  <Film className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{sec.title}</h4>
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${sec.enabled ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-white/10 text-white/40"}`}>
                      {sec.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  {sec.subtitle && <p className="text-xs text-white/40">{sec.subtitle}</p>}
                  <p className="text-[11px] text-white/50 mt-1 font-medium">
                    {Array.isArray(sec.items) ? sec.items.length : 0} items curated
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
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-xs font-bold cursor-pointer"
                  title="Toggle enabled"
                >
                  {sec.enabled ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-white/40" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingSection({ ...sec });
                    setSectionModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Edit / Add Items
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Delete section "${sec.title}"?`)) return;
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
                  className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer"
                  title="Delete"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-3xl bg-[#0d121c] border border-white/15 rounded-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-black text-white">
                {editingSection.id ? "Edit Curated Section" : "Create New Curated Section"}
              </h3>
              <button
                type="button"
                onClick={() => setSectionModalOpen(false)}
                className="p-1.5 text-white/40 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-white/70 uppercase">Title</label>
                  <input
                    type="text"
                    value={editingSection.title}
                    onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })}
                    placeholder="e.g. 🎬 Weekend Picks"
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-bold focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-white/70 uppercase">Subtitle (Optional)</label>
                  <input
                    type="text"
                    value={editingSection.subtitle || ""}
                    onChange={(e) => setEditingSection({ ...editingSection, subtitle: e.target.value })}
                    placeholder="e.g. Top staff recommendations"
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Item Search & Pick */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="text-xs font-bold text-white/70 uppercase flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-primary" />
                  Search & Add Movies / TV / Anime
                </label>
                <input
                  type="text"
                  value={pickerSearchQuery}
                  onChange={(e) => {
                    setPickerSearchQuery(e.target.value);
                    searchMediaItems(e.target.value);
                  }}
                  placeholder="Type to search (e.g. Inception, Attack on Titan, Breaking Bad)..."
                  className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary"
                />

                {pickerLoading && (
                  <div className="py-3 text-center text-xs text-white/40">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Searching catalog...
                  </div>
                )}

                {pickerResults.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-black/40 border border-white/10">
                    {pickerResults.map((item) => (
                      <div
                        key={`${item.media_type}_${item.id}`}
                        className="flex items-center gap-2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all group"
                      >
                        {item.poster_path ? (
                          <img src={item.poster_path} alt="" className="w-8 h-11 object-cover rounded shrink-0" />
                        ) : (
                          <div className="w-8 h-11 bg-white/10 rounded flex items-center justify-center text-[9px]">No img</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-white truncate">{item.title}</p>
                          <span className="text-[9px] uppercase font-semibold text-white/40">{item.media_type}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const current = Array.isArray(editingSection.items) ? editingSection.items : [];
                            if (!current.some((c: any) => c.id === item.id && c.media_type === item.media_type)) {
                              setEditingSection({ ...editingSection, items: [...current, item] });
                              showToast("success", `Added ${item.title}`);
                            }
                          }}
                          className="p-1 rounded-md bg-primary hover:bg-primary/90 text-white cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Curated Items List in Section */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="text-xs font-bold text-white/70 uppercase">
                  Curated Items ({editingSection.items?.length || 0})
                </label>

                {(!editingSection.items || editingSection.items.length === 0) ? (
                  <p className="text-xs text-white/30 italic py-2">No items added yet. Use the search bar above to add items.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {editingSection.items.map((it: any, itIdx: number) => (
                      <div
                        key={itIdx}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.04] border border-white/10"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {it.poster_path && (
                            <img src={it.poster_path} alt="" className="w-7 h-10 object-cover rounded shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{it.title || it.name}</p>
                            <span className="text-[9px] text-white/40 uppercase font-semibold">{it.media_type}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const newItems = editingSection.items.filter((_: any, i: number) => i !== itIdx);
                            setEditingSection({ ...editingSection, items: newItems });
                          }}
                          className="p-1 text-rose-400 hover:text-rose-300 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSectionModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-white/50 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!editingSection.title?.trim()) {
                    showToast("error", "Section title is required");
                    return;
                  }
                  const method = editingSection.id ? "PUT" : "POST";
                  const res = await fetch("/api/admin/home-sections", {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(editingSection),
                  });
                  if (res.ok) {
                    setSectionModalOpen(false);
                    loadSections();
                    showToast("success", editingSection.id ? "Section updated!" : "Section created!");
                  } else {
                    showToast("error", "Failed to save section");
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-extrabold shadow-lg cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Section</span>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" />
            Spotlight Featured Hero Banner
          </h3>
          <p className="text-xs text-white/50">
            Search and pick any Movie, TV Show, or Anime to feature as the spotlight banner on the homepage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white/70">Enable Spotlight</span>
          <button
            type="button"
            onClick={() => setSpotlight({ ...spotlight, enabled: !spotlight.enabled })}
            className="p-1 cursor-pointer"
          >
            {spotlight.enabled ? <ToggleRight className="w-7 h-7 text-emerald-400" /> : <ToggleLeft className="w-7 h-7 text-white/40" />}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Search Media to Feature */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-white/70 uppercase flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-primary" />
            Search & Pick Media Entry (Movies, TV Shows, Anime)
          </label>
          <input
            type="text"
            value={pickerSearchQuery}
            onChange={(e) => {
              setPickerSearchQuery(e.target.value);
              searchMediaItems(e.target.value);
            }}
            placeholder="Type to search (e.g. Inception, Attack on Titan, Solo Leveling, Breaking Bad)..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-primary"
          />

          {pickerLoading && (
            <div className="py-3 text-center text-xs text-white/40">
              <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Searching catalog...
            </div>
          )}

          {pickerResults.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-2 rounded-xl bg-black/40 border border-white/10 custom-scrollbar">
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
                  className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-primary/20 hover:border-primary/40 border border-transparent transition-all text-left group cursor-pointer"
                >
                  {item.poster_path ? (
                    <img src={item.poster_path} alt="" className="w-8 h-11 object-cover rounded shrink-0" />
                  ) : (
                    <div className="w-8 h-11 bg-white/10 rounded flex items-center justify-center text-[9px] text-white/40">No img</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white truncate group-hover:text-primary transition-colors">{item.title}</p>
                    <span className="text-[9px] uppercase font-semibold text-white/40">{item.media_type}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Media Preview Card */}
        {spotlight.title ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black/40 p-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {spotlight.backdropPath || spotlight.posterPath ? (
                  <img
                    src={spotlight.backdropPath || spotlight.posterPath}
                    alt=""
                    className="w-16 h-16 sm:w-20 sm:h-14 object-cover rounded-xl border border-white/15 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center text-xs text-white/40">
                    No Art
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-white truncate">{spotlight.title}</h4>
                    <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                      {spotlight.mediaType}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 truncate mt-0.5">
                    Target Route: <span className="text-sky-300 font-mono">{spotlight.targetUrl || "/"}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPickerSearchQuery(spotlight.title);
                  searchMediaItems(spotlight.title);
                }}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                Change Media
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-center text-xs text-white/40 italic">
            No media selected yet. Search above to choose a movie, TV show, or anime for the hero banner.
          </div>
        )}

        {/* Customization overrides */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
          <div>
            <label className="text-xs font-bold text-white/70 uppercase">Banner Badge / Tagline</label>
            <input
              type="text"
              value={spotlight.badge || ""}
              onChange={(e) => setSpotlight({ ...spotlight, badge: e.target.value })}
              placeholder="e.g. Featured Spotlight, New Episode Streaming"
              className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-bold focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-white/70 uppercase">Title (Override)</label>
            <input
              type="text"
              value={spotlight.title || ""}
              onChange={(e) => setSpotlight({ ...spotlight, title: e.target.value })}
              placeholder="Title override..."
              className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-bold focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-white/70 uppercase">Description / Synopsis</label>
          <textarea
            rows={2}
            value={spotlight.description || ""}
            onChange={(e) => setSpotlight({ ...spotlight, description: e.target.value })}
            placeholder="Custom synopsis..."
            className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary resize-none font-medium"
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
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-extrabold shadow-lg cursor-pointer disabled:opacity-50"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-400" />
            User Accounts & Role Permissions
          </h3>
          <p className="text-xs text-white/50">
            Promote users to Admin or revoke Admin permissions directly in the database.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={userQuery}
            onChange={(e) => {
              setUserQuery(e.target.value);
              loadUsers(e.target.value);
            }}
            placeholder="Search email or name..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {usersLoading ? (
        <div className="flex items-center justify-center py-16 text-white/40">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-xs font-bold">Loading users...</span>
        </div>
      ) : usersList.length === 0 ? (
        <div className="text-center py-12 text-white/40 text-xs font-bold">
          No users matching query
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {usersList.map((u) => {
            const isSelf = u.id === currentAdminId;
            const isAdmin = u.role === "admin";
            const isDisabled = u.status === "disabled";

            return (
              <div
                key={u.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  {u.image ? (
                    <img src={u.image} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-white/20" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-black text-white/70">
                      {u.name?.charAt(0) || "U"}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[160px] sm:max-w-[200px]">
                        {u.name}
                      </span>
                      {isSelf && (
                        <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          You
                        </span>
                      )}
                      <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded ${isAdmin ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-white/10 text-white/50"}`}>
                        {u.role}
                      </span>
                      {isDisabled && (
                        <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/40 truncate">{u.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
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
                          showToast("error", "Failed to update role");
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isAdmin
                          ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30"
                          : "bg-white/10 hover:bg-white/15 text-white"
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
                        }
                      }}
                      className="p-1.5 rounded-xl text-xs font-bold text-white/40 hover:text-white hover:bg-white/10 cursor-pointer"
                      title={isDisabled ? "Enable Account" : "Disable Account"}
                    >
                      {isDisabled ? <ToggleLeft className="w-5 h-5 text-rose-400" /> : <ToggleRight className="w-5 h-5 text-emerald-400" />}
                    </button>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            Custom Franchises & Collections
          </h3>
          <p className="text-xs text-white/50">
            Build dynamic collections (e.g. "Best Anime Movies", "Spider-Man Saga") displayed directly on the Franchises page.
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
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-extrabold transition-all shadow-md cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Collection</span>
        </button>
      </div>

      {franchisesLoading ? (
        <div className="flex items-center justify-center py-16 text-white/40">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-xs font-bold">Loading franchises...</span>
        </div>
      ) : customFranchisesList.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-black/20 border border-white/5 space-y-3">
          <Layers className="w-10 h-10 mx-auto text-white/20" />
          <p className="text-sm font-bold text-white/60">No dynamic collections created yet</p>
          <p className="text-xs text-white/40 max-w-sm mx-auto">
            Create collections without hardcoding code. They automatically appear on the /browse/franchises page.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {customFranchisesList.map((col) => (
            <div
              key={col.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3">
                {col.posterPath ? (
                  <img src={col.posterPath} alt="" className="w-10 h-14 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-10 h-14 bg-white/10 rounded-lg flex items-center justify-center text-[10px]">No img</div>
                )}
                <div>
                  <h4 className="text-sm font-bold text-white">{col.name}</h4>
                  <p className="text-xs text-white/40 line-clamp-1">{col.overview || "No description"}</p>
                  <p className="text-[11px] text-white/50 mt-1">
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
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-3xl bg-[#0d121c] border border-white/15 rounded-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-black text-white">
                {editingFranchise.id ? "Edit Franchise Collection" : "Create Franchise Collection"}
              </h3>
              <button
                type="button"
                onClick={() => setFranchiseModalOpen(false)}
                className="p-1.5 text-white/40 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-white/70 uppercase">Collection Name</label>
                  <input
                    type="text"
                    value={editingFranchise.name}
                    onChange={(e) => setEditingFranchise({ ...editingFranchise, name: e.target.value })}
                    placeholder="e.g. Best Anime Movies"
                    className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-bold focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-white/70 uppercase">Poster Image URL</label>
                  <input
                    type="text"
                    value={editingFranchise.posterPath || ""}
                    onChange={(e) => setEditingFranchise({ ...editingFranchise, posterPath: e.target.value })}
                    placeholder="https://..."
                    className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-white/70 uppercase">Overview</label>
                <textarea
                  rows={2}
                  value={editingFranchise.overview || ""}
                  onChange={(e) => setEditingFranchise({ ...editingFranchise, overview: e.target.value })}
                  placeholder="e.g. A handpicked collection of acclaimed anime theatrical films..."
                  className="w-full mt-1 px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Media Picker for Franchise */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="text-xs font-bold text-white/70 uppercase flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-primary" />
                  Search & Add Entries (Your Name, Spirited Away, etc.)
                </label>
                <input
                  type="text"
                  value={pickerSearchQuery}
                  onChange={(e) => {
                    setPickerSearchQuery(e.target.value);
                    searchMediaItems(e.target.value);
                  }}
                  placeholder="Search titles to add to collection..."
                  className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary"
                />

                {pickerResults.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 rounded-xl bg-black/40 border border-white/10">
                    {pickerResults.map((item) => (
                      <div
                        key={`${item.media_type}_${item.id}`}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white/5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {item.poster_path && <img src={item.poster_path} alt="" className="w-6 h-8 object-cover rounded" />}
                          <p className="text-[11px] font-bold text-white truncate">{item.title}</p>
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
                          className="p-1 rounded bg-primary text-white cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Items in Franchise */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="text-xs font-bold text-white/70 uppercase">
                  Entries in Collection ({editingFranchise.parts?.length || 0})
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {editingFranchise.parts?.map((pt: any, ptIdx: number) => (
                    <div key={ptIdx} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04] border border-white/10">
                      <span className="text-xs font-bold text-white truncate">{pt.title || pt.name}</span>
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

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setFranchiseModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-white/50 hover:text-white cursor-pointer"
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
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-extrabold shadow-lg cursor-pointer"
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-fuchsia-400" />
              Theme Studio & Custom Themes
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Create real-time custom themes on the fly using color wheels. They automatically appear in the themes drawer for all visitors!
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
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:opacity-90 text-white text-xs font-extrabold shadow-md cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Theme</span>
          </button>
        </div>

        {/* Existing Custom Themes List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-white/70 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Active Admin Custom Themes ({adminCustomThemes.length})
            </h4>
          </div>

          {adminThemesLoading ? (
            <div className="py-8 text-center text-xs text-white/40 font-bold">
              <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" /> Loading custom themes...
            </div>
          ) : adminCustomThemes.length === 0 ? (
            <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-center text-xs text-white/40 italic">
              No custom themes created yet. Click "Create New Theme" above to build one!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {adminCustomThemes.map((ct) => (
                <div
                  key={ct.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-12 h-12 rounded-xl shrink-0 shadow-md border border-white/15"
                      style={{ background: ct.preview || `linear-gradient(135deg, ${ct.background} 0%, ${ct.card} 50%, ${ct.primary} 100%)` }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">{ct.label}</span>
                        <span className={`text-[9px] uppercase font-black px-1.5 py-0.2 rounded ${ct.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/40"}`}>
                          {ct.enabled ? "Live" : "Off"}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/40 truncate">{ct.description || "Custom theme"}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ct.background }} title={`BG: ${ct.background}`} />
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ct.card }} title={`Card: ${ct.card}`} />
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ct.primary }} title={`Primary: ${ct.primary}`} />
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ct.accent }} title={`Accent: ${ct.accent}`} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
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
                      className="p-1.5 text-white/60 hover:text-white cursor-pointer"
                      title="Toggle Live"
                    >
                      {ct.enabled ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-white/40" />}
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
        <div className="pt-4 border-t border-white/10 space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-white/70">
            Site Branding & Tagline
          </h4>

          <div>
            <label className="text-xs font-bold text-white/70 uppercase">Global Header Tagline</label>
            <input
              type="text"
              value={appearance.tagline}
              onChange={(e) => setAppearance({ ...appearance, tagline: e.target.value })}
              placeholder="e.g. Movies. TV. Anime. All in one place."
              className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-primary"
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
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-extrabold shadow-lg cursor-pointer disabled:opacity-50"
            >
              {appearanceSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Tagline</span>
            </button>
          </div>
        </div>

        {/* Theme Studio Modal */}
        {themeModalOpen && editingTheme && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="relative w-full max-w-2xl bg-[#0d121c] border border-white/15 rounded-3xl p-6 shadow-2xl max-h-[92vh] flex flex-col space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-400">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Theme Creator Studio</h3>
                    <p className="text-xs text-white/40">Build a real-time custom palette</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setThemeModalOpen(false)}
                  className="p-1.5 text-white/40 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-4 flex-1 pr-1 custom-scrollbar">
                {/* Live Preview Card */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/60 flex items-center gap-1">
                    <Eye className="w-3 h-3 text-fuchsia-400" />
                    Live Palette Preview
                  </span>
                  <div
                    className="relative overflow-hidden rounded-2xl border border-white/15 p-4 shadow-xl"
                    style={{ background: previewGradient }}
                  >
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest shadow" style={{ backgroundColor: editingTheme.primary, color: "#000" }}>
                        {editingTheme.tagline || "Custom"}
                      </span>
                      <span className="text-[11px] font-bold" style={{ color: editingTheme.foreground }}>
                        {editingTheme.label || "Theme Title"}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-white/10 flex items-center justify-between" style={{ backgroundColor: editingTheme.card }}>
                      <div className="space-y-1">
                        <div className="w-24 h-2.5 rounded bg-white/40" />
                        <div className="w-16 h-2 rounded bg-white/20" />
                      </div>
                      <button
                        type="button"
                        className="px-3 py-1 rounded-lg text-[10px] font-extrabold shadow"
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
                    <label className="text-xs font-bold text-white/70 uppercase">Theme Name</label>
                    <input
                      type="text"
                      value={editingTheme.label}
                      onChange={(e) => setEditingTheme({ ...editingTheme, label: e.target.value })}
                      placeholder="e.g. Cyberpunk Neon"
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-bold focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-white/70 uppercase">Tagline</label>
                    <input
                      type="text"
                      value={editingTheme.tagline}
                      onChange={(e) => setEditingTheme({ ...editingTheme, tagline: e.target.value })}
                      placeholder="e.g. Neon"
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 uppercase">Description</label>
                  <input
                    type="text"
                    value={editingTheme.description || ""}
                    onChange={(e) => setEditingTheme({ ...editingTheme, description: e.target.value })}
                    placeholder="e.g. Vibrant cyan and neon magenta palette with dark obsidian contrast."
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Color Wheels / Pickers */}
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <span className="text-xs font-bold text-white/70 uppercase block">Color Controls</span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Background */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/10">
                      <div>
                        <span className="text-xs font-bold text-white block">Background</span>
                        <span className="text-[10px] text-white/40">{editingTheme.background}</span>
                      </div>
                      <input
                        type="color"
                        value={editingTheme.background}
                        onChange={(e) => setEditingTheme({ ...editingTheme, background: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                    </div>

                    {/* Card Surface */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/10">
                      <div>
                        <span className="text-xs font-bold text-white block">Card / Surface</span>
                        <span className="text-[10px] text-white/40">{editingTheme.card}</span>
                      </div>
                      <input
                        type="color"
                        value={editingTheme.card}
                        onChange={(e) => setEditingTheme({ ...editingTheme, card: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                    </div>

                    {/* Primary Accent */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/10">
                      <div>
                        <span className="text-xs font-bold text-white block">Primary Accent</span>
                        <span className="text-[10px] text-white/40">{editingTheme.primary}</span>
                      </div>
                      <input
                        type="color"
                        value={editingTheme.primary}
                        onChange={(e) => setEditingTheme({ ...editingTheme, primary: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                    </div>

                    {/* Secondary Accent */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/10">
                      <div>
                        <span className="text-xs font-bold text-white block">Secondary Accent</span>
                        <span className="text-[10px] text-white/40">{editingTheme.accent}</span>
                      </div>
                      <input
                        type="color"
                        value={editingTheme.accent}
                        onChange={(e) => setEditingTheme({ ...editingTheme, accent: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                    </div>

                    {/* Foreground Text */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/10 sm:col-span-2">
                      <div>
                        <span className="text-xs font-bold text-white block">Text / Foreground</span>
                        <span className="text-[10px] text-white/40">{editingTheme.foreground}</span>
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
              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setThemeModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-white/50 hover:text-white cursor-pointer"
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
                    const res = await fetch("/api/admin/themes", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(editingTheme),
                    });
                    if (res.ok) {
                      setThemeModalOpen(false);
                      loadAdminThemes();
                      refreshCustomThemes();
                      showToast("success", `Custom theme "${editingTheme.label}" published!`);
                    } else {
                      showToast("error", "Failed to save theme");
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:opacity-95 text-white text-xs font-extrabold shadow-lg cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Publish Theme Live</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Main Modal Shell */}
      <div 
        className="relative w-full max-w-5xl bg-[#0a0e17] border border-white/15 rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.9)] overflow-hidden z-10 flex flex-col my-auto max-h-[92vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 text-amber-400 shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  CineStream Admin Console
                </h2>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Admin
                </span>
              </div>
              <p className="text-xs text-white/40 font-medium">Database-driven management & real-time controls</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Sidebar Tabs + Content Area */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Left Tab Navigation */}
          <div className="w-full md:w-56 lg:w-60 bg-black/30 border-b md:border-b-0 md:border-r border-white/10 p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto shrink-0 custom-scrollbar">
            {[
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { id: "announcements", label: "Announcements", icon: Megaphone, badge: currentAnnouncement ? "Live" : null },
              { id: "sections", label: "Custom Rows", icon: Film, count: sections.length },
              { id: "spotlight", label: "Spotlight Hero", icon: Star },
              { id: "users", label: "User Accounts", icon: Users },
              { id: "franchises", label: "Franchises", icon: Layers },
              { id: "appearance", label: "Theme Studio", icon: Palette, count: adminCustomThemes.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as AdminTab)}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 md:w-full ${
                    isActive
                      ? "bg-white/15 text-white border border-white/20 shadow-md"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-white/40"}`} />
                    <span>{tab.label}</span>
                  </div>

                  {tab.badge && (
                    <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Content Panel */}
          <div className="flex-1 p-5 sm:p-6 overflow-y-auto custom-scrollbar">
            {activeTab === "dashboard" && renderDashboardTab()}
            {activeTab === "announcements" && renderAnnouncementsTab()}
            {activeTab === "sections" && renderSectionsTab()}
            {activeTab === "spotlight" && renderSpotlightTab()}
            {activeTab === "users" && renderUsersTab()}
            {activeTab === "franchises" && renderFranchisesTab()}
            {activeTab === "appearance" && renderAppearanceTab()}

            {/* Feedback Toast Notification */}
            {statusMessage && (
              <div className={`mt-4 flex items-center gap-2 p-3.5 rounded-2xl text-xs font-bold animate-fade-in ${
                statusMessage.type === "success" 
                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-lg shadow-emerald-500/10"
                  : "bg-rose-500/15 border border-rose-500/30 text-rose-300 shadow-lg shadow-rose-500/10"
              }`}>
                {statusMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{statusMessage.text}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-white/[0.02] text-[11px] text-white/40">
          <span>Admin role verified database-side</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
});
