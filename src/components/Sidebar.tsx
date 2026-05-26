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
  LogOut,
  LogIn,
  ChevronRight,
  Menu
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signIn, signOut } from "next-auth/react";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/browse/trending", icon: TrendingUp, label: "Trending" },
  { href: "/browse/movies", icon: Film, label: "Movies" },
  { href: "/browse/tv", icon: Tv, label: "TV Shows" },
  { href: "/anime", icon: Sparkles, label: "Anime" },
  ];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const user = session?.user;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-[#831C91] to-[#D552A3] shadow-lg shadow-[#831C91]/30 flex items-center justify-center"
      >
        {isOpen ? (
          <ChevronRight className="w-6 h-6 text-white" />
        ) : (
          <Menu className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/60 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[280px] md:w-56 lg:w-64 z-50 flex flex-col",
          "transition-transform duration-300 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Dark matte background */}
        <div className="absolute inset-0 bg-[#0a0a12] md:rounded-r-2xl" />
        
        {/* Logo */}
        <div className="relative z-10 p-4 md:p-3 lg:p-4">
          <Link href="/" className="flex items-center justify-center md:justify-start gap-3">
            <img src="/logo-icon.svg" alt="StreamVault" className="w-10 h-10 shrink-0 drop-shadow-lg" />
            <span className="hidden md:block font-bold text-xl tracking-wider">
              <span className="text-white">STREAM</span>
              <span className="bg-gradient-to-r from-[#D552A3] to-[#FF70BF] bg-clip-text text-transparent">VAULT</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="relative z-10 flex-1 px-3 md:px-2 lg:px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            const isAnime = href === "/anime";
            
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "group relative flex items-center justify-center md:justify-start gap-2 px-3 md:px-2 lg:px-3 py-2.5 rounded-xl transition-all duration-300",
                  isActive 
                    ? isAnime 
                      ? "text-[#D552A3]" 
                      : "text-white"
                    : isAnime
                    ? "text-[#D552A3]/60 hover:text-[#D552A3]"
                    : "text-white/50 hover:text-white"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className={cn(
                      "absolute inset-0 rounded-xl -z-10",
                      isAnime
                        ? "bg-gradient-to-r from-[#831C91]/20 to-[#D552A3]/10 border border-[#D552A3]/20"
                        : "bg-white/[0.06] border border-white/[0.08]"
                    )}
                    transition={{ type: "spring", stiffness: 380, damping: 35 }}
                  />
                )}
                
                <Icon className="w-5 h-5 shrink-0" />
                
                <span className="hidden md:block text-sm font-medium truncate">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Search */}
        <div className="relative z-10 px-3 md:px-2 lg:px-3 py-4">
          <Link
            href="/search"
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-center md:justify-start gap-2 px-3 md:px-2 lg:px-3 py-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <Search className="w-5 h-5" />
            <span className="hidden md:block text-sm font-medium">
              Search
            </span>
          </Link>
        </div>

        {/* User section */}
        <div className="relative z-10 p-3 md:p-2 lg:p-3 border-t border-white/[0.06]">
          {status !== "loading" && (
            isAuthenticated && user ? (
              <button
                onClick={() => signOut()}
                className="w-full flex items-center justify-center md:justify-start gap-2 px-3 md:px-2 lg:px-3 py-2 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
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
                <span className="hidden md:block text-sm font-medium truncate max-w-[80px]">
                  {user.name}
                </span>
              </button>
            ) : (
              <button
                onClick={() => signIn()}
                className="w-full flex items-center justify-center md:justify-start gap-2 px-3 md:px-2 lg:px-3 py-2 rounded-xl bg-[#831C91] hover:bg-[#D552A3] text-white text-xs font-bold transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden md:block">
                  Log in
                </span>
              </button>
            )
          )}
        </div>
      </aside>
    </>
  );
}

