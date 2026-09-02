"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  Film, 
  Tv, 
  Sparkles, 
  BookOpen, 
  Search, 
  User, 
  LogIn, 
  LogOut, 
  Compass, 
  Bug, 
  ShieldCheck, 
  Bookmark, 
  Info,
} from "lucide-react";
import { memo, useEffect, useState, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signIn, signOut } from "next-auth/react";
import { ThemeButton } from "@/components/ThemeButton";
import { useWatchlist } from "@/context/WatchlistContext";
import { AdminPanelModal } from "@/components/admin/AdminPanelModal";
import { useTheme } from "@/context/ThemeContext";
import { getTheme } from "@/lib/themes";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/browse/movies", label: "Movies", icon: Film },
  { href: "/browse/tv", label: "Shows", icon: Tv },
  { href: "/anime", label: "Anime", icon: Sparkles },
  { href: "/manga", label: "Manga", icon: BookOpen },
];

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const watchlist = useWatchlist();
  const watchlistCount = watchlist?.items?.length || 0;

  const isAuthenticated = status === "authenticated";
  const user = session?.user;
  const isAdmin = isAuthenticated && (user?.role === "admin" || user?.role === "owner");

  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);

  const { theme, customThemes } = useTheme();
  const currentTheme = useMemo(() => getTheme(theme, customThemes), [theme, customThemes]);

  const themeNavStyles = useMemo(() => {
    switch (theme) {
      case "cinema":
        return {
          triggerIdle: "bg-[#450A14] hover:bg-[#5C0E1C] border-[#F2C14E] text-[#FDE68A] ring-1 ring-[#F2C14E]/50 shadow-[0_4px_22px_rgba(242,193,78,0.25)]",
          triggerActive: "bg-[#F2C14E] text-[#1A0408] border-[#F2C14E] shadow-[0_0_25px_rgba(242,193,78,0.7)] font-black",
          iconOpen: "text-[#1A0408]",
          iconClosed: "text-[#F2C14E]",
          capsuleBg: "bg-[#2A060E]/98 border-[#F2C14E]/70 shadow-[0_16px_45px_rgba(69,10,20,0.9)]",
          activeLink: "bg-[#F2C14E] text-[#1A0408] font-black shadow-md",
        };
      case "wisteria":
        return {
          triggerIdle: "bg-[#3B1466] hover:bg-[#4E1985] border-[#ED80E9] text-[#F5D0FE] ring-1 ring-[#ED80E9]/50 shadow-[0_4px_22px_rgba(237,128,233,0.3)]",
          triggerActive: "bg-[#ED80E9] text-[#120624] border-[#ED80E9] shadow-[0_0_25px_rgba(237,128,233,0.7)] font-black",
          iconOpen: "text-[#120624]",
          iconClosed: "text-[#ED80E9]",
          capsuleBg: "bg-[#1E0A36]/98 border-[#ED80E9]/70 shadow-[0_16px_45px_rgba(59,20,102,0.9)]",
          activeLink: "bg-[#ED80E9] text-[#120624] font-black shadow-md",
        };
      case "solaris":
        return {
          triggerIdle: "bg-[#333810] hover:bg-[#454B16] border-[#FFFF66] text-[#FEF9C3] ring-1 ring-[#FFFF66]/50 shadow-[0_4px_22px_rgba(255,255,102,0.3)]",
          triggerActive: "bg-[#FFFF66] text-[#141608] border-[#FFFF66] shadow-[0_0_25px_rgba(255,255,102,0.7)] font-black",
          iconOpen: "text-[#141608]",
          iconClosed: "text-[#FFFF66]",
          capsuleBg: "bg-[#1B1E08]/98 border-[#FFFF66]/70 shadow-[0_16px_45px_rgba(51,56,16,0.9)]",
          activeLink: "bg-[#FFFF66] text-[#141608] font-black shadow-md",
        };
      case "glass":
        return {
          triggerIdle: "bg-[#1B2B50]/90 hover:bg-[#253B6D] border-[#8FA8F2] text-[#DBEAFE] ring-1 ring-[#8FA8F2]/50 shadow-[0_4px_22px_rgba(143,168,242,0.35)]",
          triggerActive: "bg-[#8FA8F2] text-[#0A0E1A] border-[#8FA8F2] shadow-[0_0_25px_rgba(143,168,242,0.7)] font-black",
          iconOpen: "text-[#0A0E1A]",
          iconClosed: "text-[#8FA8F2]",
          capsuleBg: "bg-[#0F1A33]/95 border-[#8FA8F2]/70 shadow-[0_16px_45px_rgba(27,43,80,0.9)] backdrop-blur-2xl",
          activeLink: "bg-[#8FA8F2] text-[#0A0E1A] font-black shadow-md",
        };
      case "oled":
        return {
          triggerIdle: "bg-black hover:bg-neutral-950 border-[#E63946] text-white ring-1 ring-[#E63946]/50 shadow-[0_4px_22px_rgba(230,57,70,0.35)]",
          triggerActive: "bg-[#E63946] text-white border-[#E63946] shadow-[0_0_25px_rgba(230,57,70,0.7)] font-black",
          iconOpen: "text-white",
          iconClosed: "text-[#E63946]",
          capsuleBg: "bg-black/98 border-[#E63946]/60 shadow-[0_16px_45px_rgba(0,0,0,1)]",
          activeLink: "bg-[#E63946] text-white font-black shadow-md",
        };
      case "global":
      default:
        if (theme?.startsWith("custom_") && currentTheme) {
          const primaryColor = currentTheme.primary || "#6366F1";
          const cardBg = currentTheme.card || currentTheme.background || "#0B0F19";
          return {
            triggerIdle: "ring-1 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
            triggerIdleStyle: { backgroundColor: cardBg, borderColor: primaryColor, color: "#ffffff" },
            triggerActive: "font-black",
            triggerActiveStyle: { backgroundColor: primaryColor, color: "#000000", borderColor: primaryColor, boxShadow: `0 0 25px ${primaryColor}90` },
            iconOpen: "text-black",
            iconClosed: "text-white",
            capsuleBg: "shadow-[0_16px_45px_rgba(0,0,0,0.85)]",
            capsuleStyle: { backgroundColor: `${cardBg}F8`, borderColor: primaryColor },
            activeLink: "font-black shadow-md",
            activeLinkStyle: { backgroundColor: primaryColor, color: "#000000" },
          };
        }
        // Midnight Black (Global)
        return {
          triggerIdle: "bg-[#0B0F19] hover:bg-[#151D2E] border-[#3B4861] text-[#F8FAFC] ring-1 ring-[#3B4861]/50 shadow-[0_8px_30px_rgba(0,0,0,0.85)]",
          triggerActive: "bg-white text-black border-white shadow-[0_0_22px_rgba(255,255,255,0.45)] font-black",
          iconOpen: "text-black",
          iconClosed: "text-[#94A3B8]",
          capsuleBg: "bg-[#0B0F19]/98 border-[#3B4861]/60 shadow-[0_16px_45px_rgba(0,0,0,0.85)]",
          activeLink: "bg-white text-black font-black shadow-md",
        };
    }
  }, [theme, currentTheme]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close menus on route change
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  // Click outside to close capsules
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setAccountOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const isWatchPage = pathname?.startsWith("/watch/") || pathname === "/watch";
  if (isWatchPage) return null;

  return (
    <>
      {/* ── Desktop Top-Left Brand Logo Button (navigates to Home) ── */}
      <Link
        href="/"
        className="hidden md:flex fixed top-4 left-6 z-[60] items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-black/40 hover:bg-black/70 border border-white/10 backdrop-blur-xl transition-all duration-200 hover:scale-[1.03] active:scale-95 group shadow-lg"
        aria-label="CineStream Home"
        title="Go to Home"
      >
        <img src="/logo-icon.svg?v=22" alt="CineStream" className="w-7 h-7 shrink-0 drop-shadow group-hover:scale-105 transition-transform" />
        <span className="font-black text-base tracking-wider">
          <span className="text-white">CINE</span>
          <span className="bg-gradient-to-r from-[#7B8EA9] via-[#A3B3CC] to-[#D3D1CE] bg-clip-text text-transparent">STREAM</span>
        </span>
      </Link>

      {/* ── Top-Right Dual Slide-Out Navigation Capsules (Desktop) ── */}
      <div 
        ref={containerRef}
        className="hidden md:flex fixed top-4 right-5 z-[60] flex-col items-end gap-2 select-none"
      >
        {/* 1. TOP CAPSULE: Explore / Main Navigation */}
        <div className="flex items-center justify-end">
          <AnimatePresence>
            {menuOpen && (
              <motion.nav
                initial={{ opacity: 0, x: 25, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 25, scale: 0.95 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                style={themeNavStyles.capsuleStyle}
                className={cn(
                  "flex items-center gap-1.5 p-1.5 mr-2 rounded-full backdrop-blur-2xl border",
                  themeNavStyles.capsuleBg
                )}
              >
                {navLinks.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={href}
                      style={isActive ? themeNavStyles.activeLinkStyle : undefined}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200",
                        isActive
                          ? themeNavStyles.activeLink
                          : "text-white/70 hover:text-white hover:bg-white/[0.08]"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{label}</span>
                    </Link>
                  );
                })}

                <div className="w-px h-4 bg-white/15 mx-0.5" />

                <Link
                  href="/search"
                  style={pathname === "/search" ? themeNavStyles.activeLinkStyle : undefined}
                  className={cn(
                    "p-2 rounded-full transition-all text-xs font-bold flex items-center justify-center",
                    pathname === "/search"
                      ? themeNavStyles.activeLink
                      : "text-white/70 hover:text-white hover:bg-white/[0.08]"
                  )}
                  title="Search"
                >
                  <Search className="w-3.5 h-3.5" />
                </Link>
              </motion.nav>
            )}
          </AnimatePresence>

          {/* Menu Trigger Button */}
          <button
            type="button"
            onClick={() => {
              setMenuOpen((prev) => !prev);
              setAccountOpen(false);
            }}
            style={menuOpen ? themeNavStyles.triggerActiveStyle : themeNavStyles.triggerIdleStyle}
            className={cn(
              "h-10 px-4 rounded-full border backdrop-blur-2xl flex items-center gap-2 transition-all duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer",
              menuOpen ? themeNavStyles.triggerActive : themeNavStyles.triggerIdle
            )}
            aria-label="Toggle Navigation Menu"
          >
            <Compass className={cn("w-4 h-4 transition-transform duration-300", menuOpen ? `rotate-45 ${themeNavStyles.iconOpen}` : themeNavStyles.iconClosed)} />
            <span className="text-xs font-extrabold tracking-wide uppercase">Menu</span>
          </button>
        </div>

        {/* 2. BOTTOM CAPSULE: Account & Preferences (Directly Below Menu Button) */}
        <div className="flex items-center justify-end">
          <AnimatePresence>
            {accountOpen && (
              <motion.div
                initial={{ opacity: 0, x: 25, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 25, scale: 0.95 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                style={themeNavStyles.capsuleStyle}
                className={cn(
                  "flex items-center gap-1.5 p-1.5 mr-2 rounded-full backdrop-blur-2xl border",
                  themeNavStyles.capsuleBg
                )}
              >
                {/* Wishlist Link */}
                <Link
                  href="/watchlist"
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all",
                    pathname === "/watchlist"
                      ? "bg-amber-400 text-black font-black"
                      : "text-white/70 hover:text-white hover:bg-white/[0.08]"
                  )}
                >
                  <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                  <span>Wishlist</span>
                  {watchlistCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black">
                      {watchlistCount}
                    </span>
                  )}
                </Link>

                {/* Themes Trigger */}
                <div className="flex items-center px-1">
                  <ThemeButton compact className="w-7 h-7 border-white/15 bg-white/5 hover:bg-white/15 rounded-full" />
                </div>

                {/* Info / Landing Page */}
                <Link
                  href="/landing"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white/70 hover:text-white hover:bg-white/[0.08] transition-all"
                  title="Landing Info Page"
                >
                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Info</span>
                </Link>

                {/* Report Issue */}
                <Link
                  href="/contact"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white/70 hover:text-white hover:bg-white/[0.08] transition-all"
                  title="Report Issue"
                >
                  <Bug className="w-3.5 h-3.5 text-rose-400" />
                  <span>Report</span>
                </Link>

                {/* Admin Panel Button if Admin or Owner */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      setAdminPanelOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Admin</span>
                  </button>
                )}

                <div className="w-px h-4 bg-white/15 mx-0.5" />

                {/* Log In / Log Out */}
                {isAuthenticated && user ? (
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: window.location.origin })}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => signIn()}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Log In</span>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Account Trigger Button */}
          <button
            type="button"
            onClick={() => {
              setAccountOpen((prev) => !prev);
              setMenuOpen(false);
            }}
            style={accountOpen ? themeNavStyles.triggerActiveStyle : themeNavStyles.triggerIdleStyle}
            className={cn(
              "h-10 px-3.5 rounded-full border backdrop-blur-2xl flex items-center gap-2 transition-all duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer",
              accountOpen ? themeNavStyles.triggerActive : themeNavStyles.triggerIdle
            )}
            aria-label="Toggle Account Menu"
          >
            {isAuthenticated && user ? (
              user.image ? (
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  className="w-5 h-5 rounded-full object-cover ring-1 ring-white/30"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-black">
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
              )
            ) : (
              <User className={cn("w-4 h-4", accountOpen ? themeNavStyles.iconOpen : themeNavStyles.iconClosed)} />
            )}
            <span className="text-xs font-extrabold tracking-wide uppercase">
              {isAuthenticated && user?.name ? user.name.split(" ")[0] : "Account"}
            </span>
          </button>
        </div>
      </div>

      {/* ── Mobile Top Header Bar ── */}
      <header className="md:hidden fixed top-0 inset-x-0 h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-[#090b10]/85 backdrop-blur-2xl border-b border-white/10 z-[60] flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <img src="/logo-icon.svg?v=22" alt="CineStream" className="w-7 h-7 shrink-0 drop-shadow-md" />
          <span className="font-black text-sm tracking-wider">
            <span className="text-white">CINE</span>
            <span className="bg-gradient-to-r from-[#7B8EA9] via-[#A3B3CC] to-[#D3D1CE] bg-clip-text text-transparent">STREAM</span>
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <Link
            href="/search"
            className={cn(
              "p-2 text-white/70 hover:text-white rounded-xl transition-all",
              pathname === "/search" && "text-white bg-white/10"
            )}
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </Link>

          <Link
            href="/watchlist"
            className={cn(
              "p-2 text-white/70 hover:text-white rounded-xl transition-all relative",
              pathname === "/watchlist" && "text-white bg-white/10"
            )}
            aria-label="Wishlist"
          >
            <Bookmark className="w-4 h-4 text-amber-400" />
            {watchlistCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 ring-2 ring-black" />
            )}
          </Link>

          <ThemeButton compact className="w-8 h-8 rounded-xl border-white/10 bg-white/5" />

          {/* Mobile Account Button */}
          <button
            type="button"
            onClick={() => setAccountOpen((prev) => !prev)}
            style={accountOpen ? themeNavStyles.triggerActiveStyle : themeNavStyles.triggerIdleStyle}
            className={cn(
              "p-1.5 ml-0.5 rounded-xl border backdrop-blur-md transition-all active:scale-95 cursor-pointer",
              accountOpen ? themeNavStyles.triggerActive : themeNavStyles.triggerIdle
            )}
            aria-label="Account"
          >
            {isAuthenticated && user ? (
              user.image ? (
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  className="w-6 h-6 rounded-full object-cover ring-1 ring-white/30"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-black">
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
              )
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <User className={cn("w-3.5 h-3.5", accountOpen ? themeNavStyles.iconOpen : themeNavStyles.iconClosed)} />
              </div>
            )}
          </button>
        </div>
      </header>

      {/* ── Mobile Account Dropdown Sheet ── */}
      <AnimatePresence>
        {accountOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={themeNavStyles.capsuleStyle}
            className={cn(
              "md:hidden fixed top-[calc(3.75rem+env(safe-area-inset-top))] right-3 z-[65] w-56 rounded-2xl backdrop-blur-2xl border p-3 shadow-2xl space-y-1.5",
              themeNavStyles.capsuleBg
            )}
          >
            {isAuthenticated && user && (
              <div className="px-2.5 py-1.5 mb-1.5 border-b border-white/10">
                <p className="text-xs font-bold text-white truncate">{user.name || "User"}</p>
                <p className="text-[10px] text-white/50 truncate">{user.email}</p>
              </div>
            )}
            <Link
              href="/watchlist"
              onClick={() => setAccountOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Bookmark className="w-4 h-4 text-amber-400" />
              <span>Wishlist ({watchlistCount})</span>
            </Link>
            <Link
              href="/landing"
              onClick={() => setAccountOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Info className="w-4 h-4 text-cyan-400" />
              <span>Info</span>
            </Link>
            <Link
              href="/contact"
              onClick={() => setAccountOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Bug className="w-4 h-4 text-rose-400" />
              <span>Report Issue</span>
            </Link>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setAccountOpen(false);
                  setAdminPanelOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Admin Panel</span>
              </button>
            )}
            <div className="pt-1 border-t border-white/10">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: window.location.origin })}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => signIn()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-black bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Log In</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile Floating Bottom Dock ── */}
      <nav className="md:hidden fixed bottom-3 inset-x-4 sm:inset-x-8 h-14 rounded-2xl bg-[#090b10]/90 backdrop-blur-2xl border border-white/15 z-40 flex items-center justify-around px-2 shadow-[0_12px_36px_rgba(0,0,0,0.85)]">
        {[
          { href: "/", icon: Home, label: "Home" },
          { href: "/browse/movies", icon: Film, label: "Movies" },
          { href: "/browse/tv", icon: Tv, label: "TV" },
          { href: "/anime", icon: Sparkles, label: "Anime" },
          { href: "/manga", icon: BookOpen, label: "Manga" },
        ].map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex-1 h-full flex flex-col items-center justify-center transition-all duration-200 select-none touch-manipulation cursor-pointer",
                isActive ? "text-white" : "text-white/45 hover:text-white/80"
              )}
            >
              {isActive && (
                <span className="absolute top-1 w-6 h-0.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              )}
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] font-bold tracking-tight">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Admin Panel Modal */}
      {isAdmin && (
        <AdminPanelModal
          isOpen={adminPanelOpen}
          onClose={() => setAdminPanelOpen(false)}
          onOpen={() => setAdminPanelOpen(true)}
        />
      )}
    </>
  );
});
