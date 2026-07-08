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
  Compass
} from "lucide-react";
import { memo, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useSession, signIn, signOut } from "next-auth/react";

const navItems: { href: string; icon: any; label: string; subtitle?: string }[] = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/browse/trending", icon: TrendingUp, label: "Trending" },
  { href: "/browse/movies", icon: Film, label: "Movies" },
  { href: "/browse/tv", icon: Tv, label: "TV Shows" },
  { href: "/anime", icon: Sparkles, label: "Anime", subtitle: "JP Dub + Eng Sub" },
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
      <header className="md:hidden fixed top-0 inset-x-0 h-14 premium-glass z-40 flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo-icon.svg" alt="CineStream" className="w-8 h-8 drop-shadow-lg" />
          <span className="font-bold text-lg tracking-wider">
            <span className="text-white">CINE</span>
            <span className="bg-gradient-to-r from-[#7288AE] to-[#EAE0CF] bg-clip-text text-transparent">STREAM</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
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
                    <div className="absolute top-full right-0 mt-2 z-50 w-44 py-1.5 rounded-xl bg-[#0d1233] border border-[#7288AE]/20 shadow-2xl shadow-black/40 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-white/[0.06]">
                        <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                      </div>
                      <button
                        onClick={() => { signOut(); setProfileOpen(false); }}
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
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 premium-glass z-40 flex items-center justify-around pb-[env(safe-area-inset-bottom)] px-2">
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
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute top-0 w-8 h-1 rounded-full bg-white"
                  transition={{ type: "spring", stiffness: 380, damping: 35 }}
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
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-56 lg:w-64 z-50 flex-col bg-[#050B14]/40 backdrop-blur-3xl border-r border-white/[0.05] shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
        {/* Logo */}
        <div className="p-4 md:p-3 lg:p-4">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo-icon.svg" alt="CineStream" className="w-10 h-10 shrink-0 drop-shadow-lg" />
            <span className="font-bold text-xl tracking-wider">
              <span className="text-white">CINE</span>
              <span className="bg-gradient-to-r from-[#7288AE] to-[#EAE0CF] bg-clip-text text-transparent">STREAM</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label, subtitle }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300",
                  isActive 
                    ? "text-white" 
                    : "text-white/50 hover:text-white"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl -z-10 bg-[#4B5694]/15 border border-[#7288AE]/20"
                    transition={{ type: "spring", stiffness: 380, damping: 35 }}
                  />
                )}
                
                <Icon className="w-5 h-5 shrink-0" />
                
                <div className="flex flex-col">
                  <span className="text-sm font-medium truncate">
                    {label}
                  </span>
                  {subtitle && (
                    <span className="text-[10px] text-white/40 truncate leading-tight">
                      {subtitle}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Search */}
        <div className="px-3 py-4">
          <Link
            href="/search"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <Search className="w-5 h-5" />
            <span className="text-sm font-medium">
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
                    <div className="absolute bottom-full left-0 mb-2 z-50 w-full py-1.5 rounded-xl bg-[#0d1233] border border-[#7288AE]/20 shadow-2xl shadow-black/40 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-white/[0.06]">
                        <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                        {user.email && (
                          <p className="text-[11px] text-white/40 truncate mt-0.5">{user.email}</p>
                        )}
                      </div>
                      <button
                        onClick={() => { signOut(); setProfileOpen(false); }}
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
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#4B5694] hover:bg-[#7288AE] text-white text-xs font-bold transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Log in</span>
              </button>
            )
          )}
        </div>
      </aside>
    </>
  );
});
