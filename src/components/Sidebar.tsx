"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  TrendingUp, 
  Film, 
  Tv, 
  Sparkles, 
  Search,
  User,
  LogIn,
  LogOut,
  Menu,
  X,
  Library,
  Compass,
  Bug,
  ShieldCheck
} from "lucide-react";
import { memo, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useSession, signIn, signOut } from "next-auth/react";
import { ThemeButton } from "@/components/ThemeButton";
import { WatchlistLink } from "@/components/WatchlistLink";
import { AdminPanelModal } from "@/components/admin/AdminPanelModal";

const navItems: { href: string; icon: any; label: string; subtitle?: string }[] = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/browse/trending", icon: TrendingUp, label: "Trending" },
  { href: "/browse/movies", icon: Film, label: "Movies" },
  { href: "/browse/tv", icon: Tv, label: "TV Shows" },
  { href: "/anime", icon: Sparkles, label: "Anime", subtitle: "JP Dub + Eng Subtitles" },
  { href: "/browse/franchises", icon: Library, label: "Franchises", subtitle: "Collections & Sagas" },
];

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const user = session?.user;
  const isAdmin = isAuthenticated && (user?.role === "admin" || user?.role === "owner");
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);

  useEffect(() => setProfileOpen(false), [pathname]);

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 premium-glass z-40 flex items-center justify-between px-3 transform-gpu will-change-transform">
        <Link href="/" className="flex items-center gap-1.5 shrink-0 min-w-0">
          <img src="/logo-icon.svg?v=22" alt="CineStream" className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-md shrink-0" />
          <span className="font-extrabold text-sm sm:text-base tracking-wider hidden min-[420px]:inline-block truncate">
            <span className="text-white">CINE</span>
            <span className="bg-gradient-to-r from-[#7B8EA9] via-[#A3B3CC] to-[#D3D1CE] bg-clip-text text-transparent">STREAM</span>
          </span>
        </Link>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <ThemeButton compact className="md:hidden" />
          <WatchlistLink compact className="md:hidden" />
          {isAdmin && (
            <button
              type="button"
              onClick={() => setAdminPanelOpen(true)}
              className="p-1.5 sm:p-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-xl transition-all touch-manipulation cursor-pointer"
              aria-label="Admin Panel"
              title="Admin Panel"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          )}
          <Link
            href="/contact"
            className="p-1.5 sm:p-2 text-white/30 hover:text-[#f59e0b] rounded-xl transition-all touch-manipulation"
            aria-label="Report Issue"
          >
            <Bug className="w-4 h-4" />
          </Link>
          <Link
            href="/search"
            className={cn(
              "p-1.5 sm:p-2 text-white/50 hover:text-white rounded-xl transition-all touch-manipulation",
              pathname === "/search" && "text-[#7288AE] bg-white/[0.06]"
            )}
            aria-label="Search"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>

          {status !== "loading" && (
            isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(v => !v)}
                  className="flex items-center p-1.5 hover:bg-white/[0.06] rounded-full transition-all touch-manipulation"
                >
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={user.name ?? "User"}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-white/20"
                    />
                  ) : (
                    <div className="p-2 rounded-xl bg-white/[0.06] text-white/60">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                </button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute top-full right-0 mt-2 z-50 w-52 py-2 rounded-2xl bg-zinc-900 border border-white/15 shadow-2xl shadow-black/80 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-white/10">
                        <p className="text-sm font-extrabold text-white truncate">{user.name}</p>
                        {isAdmin && (
                          <span className="inline-block mt-1 text-[10px] uppercase font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Admin
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => { setAdminPanelOpen(true); setProfileOpen(false); }}
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-500/10 transition-colors border-b border-white/10"
                        >
                          <ShieldCheck className="w-4 h-4 text-amber-400" />
                          Admin Panel
                        </button>
                      )}
                      <button
                        onClick={() => { signOut({ callbackUrl: window.location.origin }); setProfileOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Log out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => signIn()}
                className="p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center touch-manipulation shadow-md"
                aria-label="Log in"
              >
                <LogIn className="w-4 h-4" />
              </button>
            )
          )}
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 premium-glass z-40 flex items-center justify-around pb-[env(safe-area-inset-bottom)] px-2 transform-gpu will-change-transform">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex-1 h-full flex flex-col items-center justify-center transition-all duration-300 select-none touch-manipulation cursor-pointer",
                isActive 
                  ? "text-white" 
                  : "text-white/40 hover:text-white"
              )}
            >
              {isActive && (
                <div
                  className="absolute top-0 w-8 h-1 rounded-full bg-white transition-all duration-300"
                />
              )}
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[9px] font-semibold tracking-tight truncate max-w-full">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-56 lg:w-64 z-50 flex-col bg-background/95 backdrop-blur-sm border-r border-white/[0.08] shadow-[8px_0_32px_rgba(0,0,0,0.6)]">
        {/* Logo */}
        <div className="p-4 md:p-3 lg:p-4">
          <Link href="/" className="flex items-center gap-3 group">
            <img src="/logo-icon.svg?v=22" alt="CineStream" className="w-9 h-9 shrink-0 group-hover:scale-105 transition-transform" />
            <span className="font-extrabold text-xl tracking-wider">
              <span className="text-white">CINE</span>
              <span className="bg-gradient-to-r from-[#7B8EA9] via-[#A3B3CC] to-[#D3D1CE] bg-clip-text text-transparent">STREAM</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 select-none",
                  isActive 
                    ? "text-white font-extrabold" 
                    : "text-white/85 font-bold hover:text-white hover:bg-white/[0.08]"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl -z-10 bg-white/15 border border-white/30 shadow-[0_4px_20px_rgba(255,255,255,0.15)] backdrop-blur-md"
                    transition={{ type: "spring", stiffness: 380, damping: 35 }}
                  />
                )}
                
                <item.icon className={cn("w-5 h-5 shrink-0 transition-colors", isActive ? "text-foreground" : "text-white/80 group-hover:text-white")} />
                
                <div className="flex flex-col">
                  <span className="text-sm font-bold truncate tracking-tight">
                    {item.label}
                  </span>
                  {item.subtitle && (
                    <span className="text-[10px] text-white/60 truncate leading-tight font-semibold">
                      {item.subtitle}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Admin Panel Button (Visible only to database role === admin) */}
        {isAdmin && (
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={() => setAdminPanelOpen(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-300 hover:text-amber-200 font-extrabold text-xs transition-all shadow-sm cursor-pointer group"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate">Admin Panel</span>
            </button>
          </div>
        )}

        {/* Report Issue */}
        <div className="px-3">
          <Link
            href="/contact"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:text-[#f59e0b] hover:bg-[#f59e0b]/[0.06] transition-all text-xs font-semibold"
          >
            <Bug className="w-4 h-4" />
            <span>Report Issue</span>
          </Link>
        </div>

        {/* Search */}
        <div className="px-3 py-3">
          <Link
            href="/search"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <Search className="w-5 h-5" />
            <span className="text-sm font-bold">
              Search
            </span>
          </Link>
        </div>

        {/* User section */}
        <div className="relative p-3 border-t border-white/[0.06]">
          {status !== "loading" && (
            isAuthenticated && user ? (
              <>
                <button
                  onClick={() => setProfileOpen(v => !v)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white hover:bg-white/[0.08] transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {user.image ? (
                      <img
                        src={user.image}
                        alt={user.name ?? "User"}
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20 shrink-0"
                      />
                    ) : (
                      <div className="p-1 rounded-lg bg-white/10 text-white shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                    <span className="text-xs font-extrabold text-white truncate">
                      {user.name}
                    </span>
                  </div>
                </button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-3 z-50 w-full py-2 rounded-2xl bg-zinc-900 border border-white/15 shadow-2xl shadow-black/90 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-white/10">
                        <p className="text-sm font-extrabold text-white truncate">{user.name}</p>
                        {user.email && (
                          <p className="text-xs text-white/60 truncate mt-0.5">{user.email}</p>
                        )}
                        {isAdmin && (
                          <span className="inline-block mt-1 text-[10px] uppercase font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Admin
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => { setAdminPanelOpen(true); setProfileOpen(false); }}
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-500/10 transition-colors border-b border-white/10"
                        >
                          <ShieldCheck className="w-4 h-4 text-amber-400" />
                          Admin Panel
                        </button>
                      )}
                      <button
                        onClick={() => { signOut({ callbackUrl: window.location.origin }); setProfileOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Log out
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <button
                onClick={() => signIn()}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-extrabold transition-all shadow-lg shadow-black/30 active:scale-95 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Log in</span>
              </button>
            )
          )}
        </div>
      </aside>

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
