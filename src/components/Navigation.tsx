"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Menu, X, LogIn, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signIn, signOut } from "next-auth/react";

export function Navigation() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const user = session?.user;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); setProfileOpen(false); }, [pathname]);

  const links = [
    { href: "/", label: "Home", accent: null },
    { href: "/browse/trending", label: "Trending", accent: null },
    { href: "/browse/movies", label: "Movies", accent: null },
    { href: "/browse/tv", label: "TV Shows", accent: null },
    { href: "/anime", label: "Anime", accent: "violet" },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className={cn(
          "fixed top-0 inset-x-0 z-50 transition-all duration-500 h-16 sm:h-[72px] flex items-center px-5 md:px-10",
          isScrolled
            ? "premium-glass shadow-2xl shadow-[#4B5694]/8"
            : "bg-gradient-to-b from-[#0a0a12]/95 via-[#0a0a12]/60 to-transparent"
        )}
      >
      {isScrolled && <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-[#7288AE]/20 to-transparent" />}
        <div className="flex items-center w-full max-w-screen-2xl mx-auto gap-8">
          <Link href="/" className="shrink-0 group flex items-center gap-2">
            <img src="/logo-icon.svg" alt="CineStream" className="w-8 h-8 md:w-9 md:h-9 drop-shadow-lg" />
            <span className="font-bold text-xl md:text-2xl tracking-wider leading-none flex items-center">
              <span className="text-white group-hover:opacity-80 transition-opacity">CINE</span>
              <span className="bg-gradient-to-r from-[#7288AE] to-[#EAE0CF] bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">STREAM</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {links.map(({ href, label, accent }) => {
              const active = pathname === href || (href !== "/" && pathname.startsWith(href));
              const isAnime = accent === "violet";
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300",
                    active
                      ? isAnime 
                        ? "text-[#7288AE]" 
                        : "text-white"
                      : isAnime
                      ? "text-[#7288AE]/70 hover:text-[#7288AE]"
                      : "text-white/50 hover:text-white"
                  )}
                >
                  {label}
                  {active && (
                    <motion.div
                      layoutId="nav-pill"
                      className={cn(
                        "absolute inset-0 rounded-xl -z-10",
                        isAnime
                          ? "bg-gradient-to-r from-[#4B5694]/20 to-[#7288AE]/10 border border-[#7288AE]/20"
                          : "bg-white/[0.06] border border-white/[0.08]"
                      )}
                      transition={{ type: "spring", stiffness: 380, damping: 35 }}
                    />
                  )}
                  {!active && (
                    <motion.div
                      className="absolute inset-0 rounded-xl bg-white/[0.03] opacity-0 hover:opacity-100 transition-opacity -z-10"
                    />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/search"
              className="p-2.5 text-white/50 hover:text-white hover:bg-white/[0.08] rounded-xl transition-all duration-200 glass-light"
              aria-label="Search"
            >
              <Search className="w-[18px] h-[18px]" />
            </Link>

            {status !== "loading" && (
              isAuthenticated && user ? (
                <div className="hidden md:relative md:flex">
                  <button
                    onClick={() => setProfileOpen(v => !v)}
                    className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.07] transition-all duration-200 group"
                  >
                    {user.image ? (
                      <img
                        src={user.image}
                        alt={user.name ?? "User"}
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <span className="text-xs font-semibold text-white/70 group-hover:text-white transition-colors max-w-[80px] truncate">
                      {user.name ?? "Account"}
                    </span>
                  </button>
                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                      <div className="absolute top-full right-0 mt-2 z-50 w-48 py-1.5 rounded-xl bg-[#0d1233] border border-[#7288AE]/20 shadow-2xl shadow-black/40 overflow-hidden">
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
                </div>
              ) : (
                <button
                  onClick={() => signIn()}
                  className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/85 active:scale-95 text-primary-foreground text-xs font-bold transition-all duration-200 shadow-lg shadow-primary/20"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Log in
                </button>
              )
            )}

            <button
              className="md:hidden p-2.5 text-white/50 hover:text-white hover:bg-white/[0.07] rounded-full transition-all"
              onClick={() => setMobileOpen(v => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-[18px] h-[18px]" /> : <Menu className="w-[18px] h-[18px]" />}
            </button>
          </div>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-16 inset-x-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/[0.06] px-5 py-4 md:hidden"
          >
            {links.map(({ href, label, accent }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "block px-4 py-3 rounded-lg text-sm font-semibold transition-colors",
                  pathname === href
                    ? accent === "violet" ? "text-[#7288AE] bg-[#4B5694]/[0.08]" : "text-white bg-white/[0.08]"
                    : accent === "violet"
                    ? "text-[#7288AE]/70 hover:text-[#7288AE] hover:bg-[#4B5694]/[0.06]"
                    : "text-white/50 hover:text-white hover:bg-white/[0.04]"
                )}
              >
                {label}
              </Link>
            ))}
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              {status !== "loading" && (
                isAuthenticated ? (
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-2 px-4 py-3 w-full rounded-lg text-sm font-semibold text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                ) : (
                  <button
                    onClick={() => signIn()}
                    className="flex items-center gap-2 px-4 py-3 w-full rounded-lg text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    Log in
                  </button>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
