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
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const user = session?.user;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  const links = [
    { href: "/", label: "Home" },
    { href: "/browse/movies", label: "Movies" },
    { href: "/browse/tv", label: "TV Shows" },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={cn(
          "fixed top-0 inset-x-0 z-50 transition-all duration-500 h-16 sm:h-[72px] flex items-center px-5 md:px-10",
          isScrolled
            ? "bg-black/80 backdrop-blur-xl border-b border-white/[0.04] shadow-2xl"
            : "bg-gradient-to-b from-black/70 to-transparent"
        )}
      >
        <div className="flex items-center w-full max-w-screen-2xl mx-auto gap-8">
          <Link href="/" className="shrink-0 group">
            <span className="font-bold text-3xl tracking-widest leading-none flex items-center gap-0">
              <span
                className="transition-opacity group-hover:opacity-80"
                style={{ color: "#08f0fc" }}
              >
                STREAM
              </span>
              <span className="text-white/20 mx-1">·</span>
              <span
                className="transition-opacity group-hover:opacity-80"
                style={{ color: "#08fc92" }}
              >
                VAULT
              </span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {links.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
                    active
                      ? "text-white"
                      : "text-white/50 hover:text-white/90 hover:bg-white/[0.06]"
                  )}
                >
                  {label}
                  {active && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-white/[0.09] rounded-lg border border-white/[0.06]"
                      transition={{ type: "spring", stiffness: 380, damping: 35 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/search"
              className="p-2.5 text-white/50 hover:text-white hover:bg-white/[0.07] rounded-full transition-all duration-200"
              aria-label="Search"
            >
              <Search className="w-[18px] h-[18px]" />
            </Link>

            {status !== "loading" && (
              isAuthenticated && user ? (
                <button
                  onClick={() => signOut()}
                  className="hidden md:flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.07] transition-all duration-200 group"
                  title="Log out"
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
                  <LogOut className="w-3.5 h-3.5 text-white/30 group-hover:text-white/70 transition-colors" />
                </button>
              ) : (
                <button
                  onClick={() => signIn()}
                  className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/85 active:scale-95 text-white text-xs font-bold transition-all duration-200 shadow-lg shadow-primary/20"
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
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "block px-4 py-3 rounded-lg text-sm font-semibold transition-colors",
                  pathname === href ? "text-white bg-white/[0.08]" : "text-white/50 hover:text-white hover:bg-white/[0.04]"
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
