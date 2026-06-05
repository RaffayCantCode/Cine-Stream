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
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useSession, signIn, signOut } from "next-auth/react";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/browse/trending", icon: TrendingUp, label: "Trending" },
  { href: "/browse/movies", icon: Film, label: "Movies" },
  { href: "/browse/tv", icon: Tv, label: "TV Shows" },
  { href: "/anime", icon: Sparkles, label: "JP Dub + Eng Sub" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const user = session?.user;

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 premium-glass z-40 flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo-icon.svg" alt="StreamVault" className="w-8 h-8 drop-shadow-lg" />
          <span className="font-bold text-lg tracking-wider">
            <span className="text-white">STREAM</span>
            <span className="bg-gradient-to-r from-[#D552A3] to-[#FF70BF] bg-clip-text text-transparent">VAULT</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/search"
            className={cn(
              "p-3 text-white/50 hover:text-white rounded-xl transition-all touch-manipulation",
              pathname === "/search" && "text-[#D552A3] bg-white/[0.06]"
            )}
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </Link>

          {status !== "loading" && (
            isAuthenticated && user ? (
              <button
                onClick={() => signOut()}
                className="flex items-center p-1.5 hover:bg-white/[0.06] rounded-full transition-all touch-manipulation"
                title="Log out"
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
            ) : (
              <button
                onClick={() => signIn()}
                className="p-3 rounded-xl bg-[#831C91] text-white hover:bg-[#D552A3] transition-colors flex items-center justify-center touch-manipulation"
                aria-label="Log in"
              >
                <LogIn className="w-4 h-4" />
              </button>
            )
          )}
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 premium-glass z-40 flex items-center justify-around pb-safe px-2">
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
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-56 lg:w-64 z-50 flex-col bg-[#0a0a12] border-r border-white/[0.06]">
        {/* Logo */}
        <div className="p-4 md:p-3 lg:p-4">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo-icon.svg" alt="StreamVault" className="w-10 h-10 shrink-0 drop-shadow-lg" />
            <span className="font-bold text-xl tracking-wider">
              <span className="text-white">STREAM</span>
              <span className="bg-gradient-to-r from-[#D552A3] to-[#FF70BF] bg-clip-text text-transparent">VAULT</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
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
                    className="absolute inset-0 rounded-xl -z-10 bg-white/[0.06] border border-white/[0.08]"
                    transition={{ type: "spring", stiffness: 380, damping: 35 }}
                  />
                )}
                
                <Icon className="w-5 h-5 shrink-0" />
                
                <span className="text-sm font-medium truncate">
                  {label}
                </span>
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
        <div className="p-3 border-t border-white/[0.06]">
          {status !== "loading" && (
            isAuthenticated && user ? (
              <button
                onClick={() => signOut()}
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
            ) : (
              <button
                onClick={() => signIn()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#831C91] hover:bg-[#D552A3] text-white text-xs font-bold transition-all"
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
}
