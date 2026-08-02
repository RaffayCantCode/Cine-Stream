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
  Bug
} from "lucide-react";
import { memo, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useSession, signIn, signOut } from "next-auth/react";
import { ThemeButton } from "@/components/ThemeButton";
import { WatchlistLink } from "@/components/WatchlistLink";

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
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => setProfileOpen(false), [pathname]);

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 premium-glass z-40 flex items-center justify-between px-4 transform-gpu will-change-transform">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo-icon.svg?v=22" alt="CineStream" className="w-8 h-8 drop-shadow-md" />
          <span className="font-extrabold text-lg tracking-wider">
            <span className="text-white">CINE</span>
            <span className="bg-gradient-to-r from-[#7B8EA9] via-[#A3B3CC] to-[#D3D1CE] bg-clip-text text-transparent">STREAM</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <ThemeButton compact className="md:hidden" />
          <WatchlistLink compact className="md:hidden" />
          <Link
            href="/contact"
            className="p-2.5 text-white/30 hover:text-[#f59e0b] rounded-xl transition-all touch-manipulation"
            aria-label="Report Issue"
          >
            <Bug className="w-4 h-4" />
          </Link>
          <Link
            href="/search"
            className={cn(
              "p-3 text-white/50 hover:text-white rounded-xl transition-all touch-manipulation",
              pathname === "/search" && "text-[#7288AE] bg-white/[0.06]"
            )}
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
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
                    <div className="absolute top-full right-0 mt-2 z-50 w-44 py-1.5 rounded-xl bg-card border border-border shadow-2xl shadow-black/40 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-white/[0.06]">
                        <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                      </div>
                      <button
                        onClick={() => { signOut({ callbackUrl: window.location.origin }); setProfileOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
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
                className="p-3 rounded-xl bg-[#4B5694] text-white hover:bg-[#7288AE] transition-colors flex items-center justify-center touch-manipulation"
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
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-56 lg:w-64 z-50 flex-col bg-background/95 backdrop-blur-2xl border-r border-white/[0.08] shadow-[8px_0_32px_rgba(0,0,0,0.6)]">
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
                    className="absolute inset-0 rounded-xl -z-10 bg-card border border-white/15 shadow-md"
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
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
                >
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={user.name ?? "User"}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20"
                    />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {user.name}
                  </span>
                </button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-2 z-50 w-full py-1.5 rounded-xl bg-card border border-border shadow-2xl shadow-black/40 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-white/[0.06]">
                        <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                        {user.email && (
                          <p className="text-[11px] text-white/40 truncate mt-0.5">{user.email}</p>
                        )}
                      </div>
                      <button
                        onClick={() => { signOut({ callbackUrl: window.location.origin }); setProfileOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
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
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-card hover:bg-card/80 border border-white/15 text-foreground hover:text-white text-xs font-extrabold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-foreground" />
                <span>Log in</span>
              </button>
            )
          )}
        </div>
      </aside>
    </>
  );
});
